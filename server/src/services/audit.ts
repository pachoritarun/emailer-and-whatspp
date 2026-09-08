import { getMemoryStore, commitStoreMutation } from '../db/pool.js';
import { sanitizePrivacyData, logger } from './logger.js';

export interface AuditLogEntry {
  userId?: string;
  userRole: string;
  action: string;
  entity: string;
  entityId?: string;
  ipAddress: string;
  userAgent?: string;
  success?: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

export class AuditService {
  static async log(entry: AuditLogEntry): Promise<void> {
    const store = getMemoryStore();
    const sanitizedMetadata = entry.metadata ? sanitizePrivacyData(entry.metadata) : null;

    const logRecord = {
      id: store.audit_logs.length + 1,
      user_id: entry.userId || null,
      user_role: entry.userRole,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId || null,
      ip_address: entry.ipAddress || '127.0.0.1',
      user_agent: entry.userAgent || 'UniversityPortalBackend/1.0',
      success: entry.success !== false ? 1 : 0,
      reason: entry.reason || null,
      metadata: sanitizedMetadata,
      created_at: new Date().toISOString(),
    };

    store.audit_logs.unshift(logRecord);
    commitStoreMutation();

    logger.info('AUDIT_LOG_RECORDED', `Admin action recorded: ${entry.action} on ${entry.entity}`, {
      user_id: entry.userId,
      details: { action: entry.action, entity: entry.entity, entity_id: entry.entityId }
    });
  }

  static getLogs(limit = 100) {
    const store = getMemoryStore();
    return store.audit_logs.slice(0, limit);
  }
}
