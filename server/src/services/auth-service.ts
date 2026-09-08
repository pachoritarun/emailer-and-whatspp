import crypto from 'crypto';
import { getMemoryStore, commitStoreMutation, executeQuery, isDbFallback } from '../db/pool.js';
import { hashPassword, verifyPassword } from './crypto.js';
import { AuditService } from './audit.js';
import { logger } from './logger.js';

export interface UserRecord {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
  role: 'DEVELOPER' | 'SENDER';
  full_name: string;
  email?: string;
  must_change_credentials: number; // 1 = true, 0 = false
  is_active: number;
  last_login_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// In-memory active session tokens for fast validation
const activeSessions = new Map<string, { userId: string; username: string; role: string; expiresAt: number }>();

export class AuthService {
  /**
   * Initializes users table and seeds initial Developer and Sender credentials
   */
  static async initAuth(): Promise<void> {
    const defaultDevPassword = 'Pass46979@devjecrcu';
    const defaultSenderPassword = 'Pass4sender@70789';

    // 1. If native MySQL is reachable, ensure table & columns exist
    if (!isDbFallback()) {
      try {
        await executeQuery(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(36) PRIMARY KEY,
            username VARCHAR(100) NOT NULL UNIQUE,
            email VARCHAR(255) NULL,
            password_hash VARCHAR(255) NOT NULL,
            salt VARCHAR(64) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'SENDER',
            full_name VARCHAR(150) NOT NULL,
            must_change_credentials TINYINT(1) NOT NULL DEFAULT 1,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            failed_login_attempts INT NOT NULL DEFAULT 0,
            locked_until DATETIME NULL,
            last_login_at DATETIME(3) NULL,
            created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
            INDEX idx_user_username (username),
            INDEX idx_user_role (role)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Check if Developer exists
        const devRows = await executeQuery<any>('SELECT id FROM users WHERE username = ?', ['Developer']);
        if (devRows.length === 0) {
          const { hash, salt } = hashPassword(defaultDevPassword);
          await executeQuery(`
            INSERT INTO users (id, username, email, password_hash, salt, role, full_name, must_change_credentials, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, ['USR-DEV-001', 'Developer', 'developer@jecrcu.edu.in', hash, salt, 'DEVELOPER', 'System Developer & Forensics Admin', 1, 1]);
          logger.info('AUTH_SEEDED_DEVELOPER', 'Seeded initial Developer account in MySQL with encryption');
        }

        // Check if Sender exists
        const senderRows = await executeQuery<any>('SELECT id FROM users WHERE username = ?', ['Sender']);
        if (senderRows.length === 0) {
          const { hash, salt } = hashPassword(defaultSenderPassword);
          await executeQuery(`
            INSERT INTO users (id, username, email, password_hash, salt, role, full_name, must_change_credentials, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, ['USR-SENDER-001', 'Sender', 'sender@jecrcu.edu.in', hash, salt, 'SENDER', 'Official Notice & Broadcast Sender', 1, 1]);
          logger.info('AUTH_SEEDED_SENDER', 'Seeded initial Sender account in MySQL with encryption');
        }
      } catch (err: any) {
        logger.error('AUTH_DB_INIT_ERR', 'Error setting up users table in MySQL: ' + err.message);
      }
    }

    // 2. Always ensure users exist in memoryStore (for fallback or dev modes)
    const store = getMemoryStore();
    if (!store.users) {
      store.users = [];
    }

    const devInStore = store.users.find((u: any) => u.username?.toLowerCase() === 'developer');
    if (!devInStore) {
      const { hash, salt } = hashPassword(defaultDevPassword);
      store.users.push({
        id: 'USR-DEV-001',
        username: 'Developer',
        email: 'developer@jecrcu.edu.in',
        password_hash: hash,
        salt,
        role: 'DEVELOPER',
        full_name: 'System Developer & Forensics Admin',
        must_change_credentials: 1,
        is_active: 1,
        created_at: new Date().toISOString()
      });
      commitStoreMutation();
    }

    const senderInStore = store.users.find((u: any) => u.username?.toLowerCase() === 'sender');
    if (!senderInStore) {
      const { hash, salt } = hashPassword(defaultSenderPassword);
      store.users.push({
        id: 'USR-SENDER-001',
        username: 'Sender',
        email: 'sender@jecrcu.edu.in',
        password_hash: hash,
        salt,
        role: 'SENDER',
        full_name: 'Official Notice & Broadcast Sender',
        must_change_credentials: 1,
        is_active: 1,
        created_at: new Date().toISOString()
      });
      commitStoreMutation();
    }
  }

  /**
   * Authenticate user with username and password
   */
  static async login(username: string, password: string, ipAddress = '127.0.0.1', userAgent = ''): Promise<{
    success: boolean;
    error?: string;
    token?: string;
    user?: {
      id: string;
      username: string;
      role: 'DEVELOPER' | 'SENDER';
      fullName: string;
      mustChangeCredentials: boolean;
    };
  }> {
    if (!username || !password) {
      return { success: false, error: 'Please provide both username and password' };
    }

    const trimmedUsername = username.trim();
    let user: UserRecord | null = null;

    // Try DB first if not fallback
    if (!isDbFallback()) {
      try {
        const rows = await executeQuery<UserRecord>(
          'SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
          [trimmedUsername]
        );
        if (rows.length > 0) {
          user = rows[0];
        }
      } catch (err: any) {
        logger.warn('AUTH_DB_QUERY_WARN', 'Failed querying user from MySQL, checking fallback store: ' + err.message);
      }
    }

    // Fallback store lookup
    if (!user) {
      const store = getMemoryStore();
      user = store.users.find((u: any) => u.username?.toLowerCase() === trimmedUsername.toLowerCase()) || null;
    }

    if (!user) {
      await AuditService.log({
        userRole: 'ANONYMOUS',
        action: 'FAILED_LOGIN',
        entity: 'USER_AUTH',
        ipAddress,
        userAgent,
        success: false,
        reason: `User '${trimmedUsername}' not found`,
        metadata: { attempted_username: trimmedUsername }
      });
      return { success: false, error: 'Invalid username or password' };
    }

    // Verify encrypted password against salt
    const isMatch = verifyPassword(password, user.password_hash, user.salt);
    if (!isMatch) {
      await AuditService.log({
        userId: user.id,
        userRole: user.role,
        action: 'FAILED_LOGIN',
        entity: 'USER_AUTH',
        ipAddress,
        userAgent,
        success: false,
        reason: 'Password mismatch',
        metadata: { username: user.username }
      });
      return { success: false, error: 'Invalid username or password' };
    }

    // Generate session token (valid 24h)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    activeSessions.set(token, {
      userId: user.id,
      username: user.username,
      role: user.role,
      expiresAt
    });

    // Update last login timestamp
    const now = new Date().toISOString();
    user.last_login_at = now;
    if (!isDbFallback()) {
      try {
        await executeQuery('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
      } catch (e) {}
    }
    commitStoreMutation();

    // Log successful login
    await AuditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'USER_LOGIN',
      entity: 'USER_AUTH',
      entityId: user.id,
      ipAddress,
      userAgent,
      success: true,
      metadata: {
        username: user.username,
        role: user.role,
        must_change_credentials: Boolean(user.must_change_credentials)
      }
    });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name,
        mustChangeCredentials: Boolean(user.must_change_credentials)
      }
    };
  }

  /**
   * Change username and/or password (e.g. mandatory first-time setup or user request)
   */
  static async changeCredentials(
    userId: string,
    newUsername: string,
    newPassword?: string,
    ipAddress = '127.0.0.1',
    userAgent = ''
  ): Promise<{ success: boolean; error?: string; user?: any }> {
    const trimmedUsername = newUsername?.trim();
    if (!trimmedUsername || trimmedUsername.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters long' };
    }

    let user: UserRecord | null = null;
    const store = getMemoryStore();

    // 1. Fetch current user
    if (!isDbFallback()) {
      try {
        const rows = await executeQuery<UserRecord>('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
        if (rows.length > 0) user = rows[0];
      } catch (e) {}
    }
    if (!user) {
      user = store.users.find((u: any) => u.id === userId) || null;
    }

    if (!user) {
      return { success: false, error: 'User account not found' };
    }

    // 2. Check if new username is taken by another user
    let existing: UserRecord | null = null;
    if (!isDbFallback()) {
      try {
        const rows = await executeQuery<UserRecord>(
          'SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND id != ? LIMIT 1',
          [trimmedUsername, userId]
        );
        if (rows.length > 0) existing = rows[0];
      } catch (e) {}
    }
    if (!existing) {
      existing = store.users.find(
        (u: any) => u.id !== userId && u.username?.toLowerCase() === trimmedUsername.toLowerCase()
      ) || null;
    }

    if (existing) {
      return { success: false, error: 'That username is already taken. Please pick another one.' };
    }

    // 3. Update password if provided
    let newHash = user.password_hash;
    let newSalt = user.salt;
    if (newPassword && newPassword.trim()) {
      if (newPassword.length < 6) {
        return { success: false, error: 'New password must be at least 6 characters long' };
      }
      const encrypted = hashPassword(newPassword);
      newHash = encrypted.hash;
      newSalt = encrypted.salt;
    }

    const oldUsername = user.username;
    user.username = trimmedUsername;
    user.password_hash = newHash;
    user.salt = newSalt;
    user.must_change_credentials = 0;
    user.updated_at = new Date().toISOString();

    // Update in MySQL
    if (!isDbFallback()) {
      try {
        await executeQuery(`
          UPDATE users 
          SET username = ?, password_hash = ?, salt = ?, must_change_credentials = 0, updated_at = NOW() 
          WHERE id = ?
        `, [trimmedUsername, newHash, newSalt, userId]);
      } catch (err: any) {
        logger.error('CHANGE_CREDS_SQL_ERR', 'Error updating credentials in DB: ' + err.message);
      }
    }

    // Update memoryStore entry
    const idx = store.users.findIndex((u: any) => u.id === userId);
    if (idx !== -1) {
      store.users[idx] = { ...user };
    }
    commitStoreMutation();

    // Log credential change in forensic audit trail
    await AuditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'CREDENTIALS_CHANGED',
      entity: 'USER_PROFILE',
      entityId: user.id,
      ipAddress,
      userAgent,
      success: true,
      metadata: {
        old_username: oldUsername,
        new_username: trimmedUsername,
        role: user.role,
        password_updated: Boolean(newPassword && newPassword.trim())
      }
    });

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name,
        mustChangeCredentials: false
      }
    };
  }

  /**
   * Validate a session token
   */
  static validateToken(token?: string): { valid: boolean; session?: { userId: string; username: string; role: string } } {
    if (!token) return { valid: false };
    const session = activeSessions.get(token);
    if (!session) return { valid: false };
    if (Date.now() > session.expiresAt) {
      activeSessions.delete(token);
      return { valid: false };
    }
    return { valid: true, session };
  }

  /**
   * Retrieve Sender Activity for the Developer Console
   */
  static async getSenderActivity(limit = 100): Promise<any[]> {
    const store = getMemoryStore();
    const allAuditLogs = store.audit_logs || [];

    // Filter for activities belonging to Sender or messages/campaigns/logins
    const senderActivities = allAuditLogs.filter((l: any) => {
      const isSenderRole = l.user_role === 'SENDER';
      const isSenderAction = [
        'USER_LOGIN',
        'CREDENTIALS_CHANGED',
        'WHATSAPP_CAMPAIGN_LAUNCHED',
        'EMAIL_DISPATCH',
        'EMAIL_BATCH_DISPATCHED',
        'CONTACT_IMPORT',
        'NOTICE_DISPATCHED'
      ].includes(l.action);
      return isSenderRole || (isSenderAction && l.user_role !== 'DEVELOPER');
    });

    return senderActivities.slice(0, limit);
  }
}
