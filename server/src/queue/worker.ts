import { config } from '../config/index.js';
import { MysqlMessageQueue } from './mysql-queue.js';
import { WhatsAppProviderService } from '../services/whatsapp-provider.js';
import { MessageLifecycleService } from '../services/message-lifecycle.js';
import { getMemoryStore, initDbPool, executeQuery } from '../db/pool.js';
import { logger } from '../services/logger.js';
import { decryptPhone } from '../services/crypto.js';

let isRunning = true;
const workerId = config.workerId;

// Heartbeat interval
setInterval(() => {
  if (!isRunning) return;
  logger.debug('WORKER_HEARTBEAT', `Worker ${workerId} healthy`, {
    worker_id: workerId,
    details: { memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024) }
  });
}, 30000);

export async function startWorkerLoop(): Promise<void> {
  await initDbPool();
  logger.info('WORKER_START', `Queue worker ${workerId} initialized and listening for jobs`, {
    worker_id: workerId,
    details: { concurrency: config.workerConcurrency, max_retries: config.queue.maxRetries }
  });

  while (isRunning) {
    try {
      // 1. Check for and claim available job
      const job = await MysqlMessageQueue.claimJob(workerId);

      if (!job) {
        // Queue is idle: sleep 500ms before polling
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      // 2. Mark recipient state as PROCESSING
      await MessageLifecycleService.recordTransition({
        recipientId: job.campaign_recipient_id,
        campaignId: job.campaign_id,
        correlationId: job.correlation_id,
        eventType: 'PROCESSING',
        newStatus: 'PROCESSING',
        workerId
      });

      // 3. Resolve campaign & template details
      const store = getMemoryStore();
      const campaign = store.campaigns.find(c => c.id === job.campaign_id);
      const snapshot = store.campaign_snapshots?.find(s => s.campaign_id === job.campaign_id);
      const template = store.message_templates.find(t => t.id === campaign?.template_id);

      const templateName = snapshot?.template_snapshot?.variables?.meta_template_name
        || snapshot?.template_snapshot?.name
        || template?.name
        || 'ganesh_chaturthi';

      const language = snapshot?.template_snapshot?.language
        || template?.language
        || 'en';

      // Extract dynamic variable values: support both positional {{1}}, {{2}} and named {{first_name}}
      const rawVars = snapshot?.template_snapshot?.variables || {};
      const mediaKeys = ['_header_media_url', 'header_media_url', 'media_url', '_header_media_type', 'header_media_type', 'media_type', '_header_media_filename', 'header_filename'];
      const paramKeys = Object.keys(rawVars).filter(k => k !== 'meta_template_name' && !mediaKeys.includes(k));
      const isPositional = paramKeys.length > 0 && paramKeys.every(k => /^\d+$/.test(k));

      // Check if template has header media
      let headerMedia: { type: 'image' | 'document' | 'video'; link: string; filename?: string } | undefined = undefined;
      const mediaUrl = rawVars._header_media_url || rawVars.header_media_url || rawVars.media_url;
      if (mediaUrl) {
        const mediaType = ((rawVars._header_media_type || rawVars.header_media_type || 'image') as string).toLowerCase() as 'image' | 'document' | 'video';
        headerMedia = {
          type: mediaType,
          link: String(mediaUrl),
          filename: rawVars._header_media_filename || rawVars.header_filename || (mediaType === 'document' ? 'Document.pdf' : undefined)
        };
      }

      const recipient = store.campaign_recipients?.find(r => r.id === job.campaign_recipient_id);
      let recipientName = 'Student';
      let recipientPhone = process.env.TEST_RECIPIENT_PHONE || process.env.RECIPIENT_PHONE_NUMBER || '';

      // Look up real contact in MySQL if available
      if (recipient?.contact_id && recipient.contact_id !== 'CNT-LOCAL-TEST') {
        try {
          const rawContact = await executeQuery(
            'SELECT first_name, last_name, phone_encrypted FROM contacts WHERE id = ?',
            [recipient.contact_id]
          );
          if (Array.isArray(rawContact) && rawContact.length > 0) {
            const c = rawContact[0];
            const nameParts = [c.first_name, c.last_name]
              .filter(Boolean)
              .map((s: string) => s.trim())
              .filter((s: string) => s && s.toLowerCase() !== 'contact');
            const fullName = nameParts.join(' ').trim();
            if (fullName) recipientName = fullName;

            if (c.phone_encrypted) {
              const decrypted = decryptPhone(c.phone_encrypted);
              if (decrypted) {
                recipientPhone = decrypted;
              }
            }
          }
        } catch (err: any) {
          logger.warn('CONTACT_RESOLVE_FAIL', `Could not decrypt phone for recipient ${recipient.contact_id}`);
        }
      }

      let resolvedParameters: Array<{ type: 'text'; text: string; parameter_name?: string }> = [];
      if (isPositional) {
        const sortedKeys = paramKeys.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        resolvedParameters = sortedKeys.map(k => {
          let val = String(rawVars[k] || '');
          if (
            val.includes('[Auto: Recipient Full Name]') ||
            val.includes('[Student Name]') ||
            val === 'Aarav Sharma' ||
            (k === '1' && val.toLowerCase().includes('name'))
          ) {
            val = recipientName;
          }
          return { type: 'text' as const, text: val };
        });
      } else {
        resolvedParameters = paramKeys.map(k => {
          let val = String(rawVars[k] || '');
          if (
            val.includes('[Auto: Recipient Full Name]') ||
            val.includes('[Student Name]') ||
            val === 'Aarav Sharma' ||
            k.toLowerCase().includes('name')
          ) {
            val = recipientName;
          }
          return { type: 'text' as const, parameter_name: k, text: val };
        });
      }

      // 4. Dispatch to WhatsApp Provider
      const result = await WhatsAppProviderService.sendTemplateMessage({
        campaignId: job.campaign_id,
        recipientId: job.campaign_recipient_id,
        correlationId: job.correlation_id,
        templateName,
        language,
        parameters: resolvedParameters,
        headerMedia,
        recipientPhone,
        workerId
      });

      if (result.success && result.provider_message_id) {
        // Complete the job
        await MysqlMessageQueue.completeJob(job.id, workerId);

        // Record transition to SUBMITTED_TO_PROVIDER
        await MessageLifecycleService.recordTransition({
          recipientId: job.campaign_recipient_id,
          campaignId: job.campaign_id,
          correlationId: job.correlation_id,
          eventType: 'SUBMITTED',
          newStatus: 'SUBMITTED_TO_PROVIDER',
          providerMessageId: result.provider_message_id,
          workerId
        });
      } else {
        // Handle failure: retry or dead-letter
        const disposition = await MysqlMessageQueue.failJob(
          job.id,
          workerId,
          result.error_message || 'WhatsApp Provider Rejection',
          !result.retryable
        );

        await MessageLifecycleService.recordTransition({
          recipientId: job.campaign_recipient_id,
          campaignId: job.campaign_id,
          correlationId: job.correlation_id,
          eventType: disposition === 'RETRY' ? 'RETRY_STARTED' : 'FAILED',
          newStatus: disposition === 'RETRY' ? 'RETRYING' : 'FAILED',
          providerErrorCode: result.error_code,
          providerErrorMessage: result.error_message,
          retryable: result.retryable,
          retryCount: job.retry_count + 1,
          workerId
        });
      }
    } catch (loopError: any) {
      logger.critical('WORKER_UNHANDLED_EXCEPTION', 'Exception caught in worker loop', {
        worker_id: workerId,
        details: { error: loopError.message, stack: loopError.stack }
      });
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  logger.info('WORKER_STOPPED', `Worker ${workerId} gracefully stopped`, { worker_id: workerId });
}

// Graceful Linux systemd shutdown signals
function handleShutdown(signal: string) {
  logger.info('WORKER_SIGNAL_RECEIVED', `Worker received ${signal}, initiating graceful shutdown`, {
    worker_id: workerId,
    details: { signal }
  });
  isRunning = false;
  setTimeout(() => process.exit(0), 5000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Direct execution support
if (process.argv[1]?.endsWith('worker.js') || process.argv[1]?.endsWith('worker.ts')) {
  startWorkerLoop();
}

