import { Router } from 'express';
import { AuditService } from '../services/audit.js';

export const auditRouter = Router();

// GET /api/audit-logs - Section 11 Administrative Audit Trail
auditRouter.get('/', (req, res) => {
  const limit = parseInt(req.query.limit as string || '100', 10);
  const logs = AuditService.getLogs(limit);
  res.json({
    success: true,
    total: logs.length,
    logs
  });
});
