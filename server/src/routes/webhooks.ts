import { Router } from 'express';
import { config } from '../config/index.js';
import { WebhookHandlerService } from '../services/webhook-handler.js';
import { logger } from '../services/logger.js';

export const webhookRouter = Router();

// GET /webhook/whatsapp - Meta Verification Handshake
webhookRouter.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.webhookVerifyToken) {
    logger.info('WEBHOOK_CHALLENGE_VERIFIED', 'WhatsApp Meta webhook challenge verified successfully');
    return res.status(200).send(challenge);
  }

  logger.warn('WEBHOOK_CHALLENGE_FAILED', 'Invalid webhook verification token received', {
    details: { mode, token_matched: false }
  });
  return res.sendStatus(403);
});

// POST /webhook/whatsapp - Ingest Status Updates
webhookRouter.post('/', async (req, res) => {
  try {
    const result = await WebhookHandlerService.processWebhook(req.body);
    logger.info('WEBHOOK_PROCESSED', `Processed ${result.processed} events, ${result.duplicates} duplicates ignored`, {
      details: result
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    logger.error('WEBHOOK_PROCESS_ERROR', 'Failed processing incoming webhook payload', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
