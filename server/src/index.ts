import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { config } from './config/index.js';
import { initDbPool } from './db/pool.js';
import { logger } from './services/logger.js';
import { campaignRouter } from './routes/campaigns.js';
import { diagnosticsRouter } from './routes/diagnostics.js';
import { observabilityRouter } from './routes/observability.js';
import { eventsRouter } from './routes/events.js';
import { contactsRouter } from './routes/contacts.js';
import { webhookRouter } from './routes/webhooks.js';
import { auditRouter } from './routes/audit.js';
import { templatesRouter } from './routes/templates.js';
import { emailerRouter } from './routes/emailer.js';
import { authRouter } from './routes/auth.js';
import { AuthService } from './services/auth-service.js';
import { startWorkerLoop } from './queue/worker.js';

const app = express();

// Security & Parsing
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Correlation ID & Forensic Request Middleware
app.use((req, res, next) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `CORR-REQ-${crypto.randomBytes(6).toString('hex')}`;
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.debug('HTTP_REQUEST', `${req.method} ${req.originalUrl} [${res.statusCode}] - ${duration}ms`, {
      correlation_id: correlationId,
      operation: 'HTTP_TRANSACTION',
      duration_ms: duration,
      result: res.statusCode < 400 ? 'SUCCESS' : 'FAILURE',
      details: { method: req.method, path: req.originalUrl, status: res.statusCode }
    });
  });

  next();
});

// Route Mounting
app.use('/webhook/whatsapp', webhookRouter);
app.use('/api/campaigns', campaignRouter);
app.use('/api/diagnostics', diagnosticsRouter);
app.use('/api/observability', observabilityRouter);
app.use('/api/events', eventsRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/audit-logs', auditRouter);
app.use('/api/email', emailerRouter);
app.use('/api/send-emails', emailerRouter);
app.use('/api/auth', authRouter);

// Root & Health Probe
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'University Enterprise Communication Portal Core',
    timestamp: new Date().toISOString(),
    version: '1.4.0-linux-native'
  });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.critical('UNHANDLED_ROUTE_EXCEPTION', 'Uncaught exception in HTTP handler', {
    correlation_id: req.headers['x-correlation-id'] as string,
    details: { error: err.message, stack: err.stack }
  });

  res.status(500).json({
    success: false,
    error_code: 'SYSTEM_ERROR',
    message: 'An internal server error occurred. This event has been recorded in the forensic audit log.'
  });
});

async function bootstrap() {
  await initDbPool();
  await AuthService.initAuth();

  app.listen(config.port, '0.0.0.0', () => {
    logger.info('SERVER_START', `University Communication Portal API listening on port ${config.port}`, {
      details: { port: config.port, env: config.nodeEnv }
    });

    if (process.env.AUTO_START_WORKER !== 'false') {
      startWorkerLoop().catch(err => {
        logger.error('WORKER_ERROR', 'Background worker loop encountered error', { details: { error: err.message } });
      });
    }
  });
}

bootstrap().catch(err => {
  logger.critical('BOOTSTRAP_FAILURE', 'Fatal error during server bootstrap', {
    details: { error: err.message, stack: err.stack }
  });
  process.exit(1);
});
