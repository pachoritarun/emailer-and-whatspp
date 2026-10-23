import crypto from 'crypto';

// 32-byte key for AES-256
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'uni_enterprise_secure_key_2026_!';
const KEY_BUFFER = crypto.createHash('sha256').update(SECRET_KEY).digest();
const IV_LENGTH = 16; // AES block size

/**
 * Standardize phone number into pure numeric string with country code (e.g. 919309313044)
 */
export function cleanPhoneNumber(rawPhone: any): string {
  if (!rawPhone) return '';
  let str = String(rawPhone).trim();
  // Strip trailing .0 or .00 from excel numeric conversions
  str = str.replace(/\.0+$/, '');

  // If cell contains multiple numbers or extra text, extract first 10-digit Indian mobile (starts with 6-9)
  const mobileMatch = str.match(/(?:(?:\+?91|0)[\s\-]?)?([6-9]\d{9})/);
  if (mobileMatch && mobileMatch[1]) {
    return '91' + mobileMatch[1];
  }

  // Remove all non-digits as fallback
  const digits = str.replace(/\D/g, '');

  // If 10 digits (standard Indian mobile e.g. 9309313044), add country code 91
  if (digits.length === 10) {
    return '91' + digits;
  }
  // If starts with 0 and followed by 10 digits
  if (digits.length === 11 && digits.startsWith('0')) {
    return '91' + digits.slice(1);
  }
  // If already 12 digits starting with 91
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }

  return digits;
}

/**
 * SHA-256 deterministic hash for phone deduplication without exposing plain numbers
 */
export function hashPhone(phone: string): string {
  const cleaned = cleanPhoneNumber(phone);
  return crypto.createHash('sha256').update(cleaned).digest('hex');
}

/**
 * AES-256-CBC encryption of phone number, returning a Buffer for MySQL VARBINARY(255)
 */
export function encryptPhone(phone: string): Buffer {
  const cleaned = cleanPhoneNumber(phone);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY_BUFFER, iv);
  const encrypted = Buffer.concat([cipher.update(cleaned, 'utf8'), cipher.final()]);
  // Prepend IV to encrypted payload
  return Buffer.concat([iv, encrypted]);
}

/**
 * Decrypts VARBINARY buffer from MySQL back into plain phone string
 */
export function decryptPhone(encryptedBuffer: Buffer | Uint8Array | string): string {
  try {
    let buf: Buffer;
    if (Buffer.isBuffer(encryptedBuffer)) {
      buf = encryptedBuffer;
    } else if (typeof encryptedBuffer === 'string') {
      buf = Buffer.from(encryptedBuffer, 'hex');
    } else {
      buf = Buffer.from(encryptedBuffer);
    }

    if (buf.length < IV_LENGTH) return '';

    const iv = buf.subarray(0, IV_LENGTH);
    const encryptedText = buf.subarray(IV_LENGTH);
    const decipher = crypto.createDecipheriv('aes-256-cbc', KEY_BUFFER, iv);
    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    return '';
  }
}

/**
 * PBKDF2 password hashing with cryptographically random salt (100,000 iterations, 64-byte key, SHA-512)
 */
export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Verify a plain text password against a stored PBKDF2 hash and salt using timingSafeEqual
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derivedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    const derivedBuffer = Buffer.from(derivedHash, 'hex');
    if (hashBuffer.length !== derivedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(hashBuffer, derivedBuffer);
  } catch (err) {
    return false;
  }
}
