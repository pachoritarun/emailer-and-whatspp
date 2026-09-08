import crypto from 'crypto';
import { getMemoryStore, commitStoreMutation } from '../db/pool.js';
import { MessageLifecycleService, LifecycleStatus, EventType } from './message-lifecycle.js';
import { logger } from './logger.js';

export interface WebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        statuses?: Array<{
          id: string; // provider_message_id (wamid.xxx)
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id?: string;
          errors?: Array<{ code: number; title: string; message: string }>;
        }>;
      };
      field: string;
    }>;
  }>;
}

export class WebhookHandlerService {
  /**
   * Process WhatsApp Webhook event with SHA-256 deduplication and idempotency
   */
  static async processWebhook(rawPayload: any): Promise<{ processed: number; duplicates: number }> {
    const store = getMemoryStore();
    const payloadStr = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);
    const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

    let processedCount = 0;
    let duplicateCount = 0;

    // Inspect entries and statuses
    const statuses = rawPayload.entry?.flatMap((e: any) =>
      e.changes?.flatMap((c: any) => c.value?.statuses || [])
    ) || [];

    for (const st of statuses) {
      const providerMsgId = st.id;
      const providerStatus = st.status;
      const providerEventId = `WH-EVT-${providerMsgId}-${providerStatus}-${st.timestamp}`;

      // 1. Check idempotency: Have we already processed this exact event?
      const existing = store.webhook_events.find(
        w => w.provider_event_id === providerEventId || w.payload_hash === payloadHash
      );

      if (existing) {
        duplicateCount++;
        logger.warn('WEBHOOK_DUPLICATE_DETECTED', `Duplicate webhook received for event ${providerEventId}`, {
          details: { provider_message_id: providerMsgId, status: providerStatus }
        });
        continue;
      }

      // 2. Find matching campaign recipient
      const recipient = store.campaign_recipients.find(r => r.provider_message_id === providerMsgId);

      // Record webhook event
      const webhookRecord = {
        id: store.webhook_events.length + 1,
        provider_event_id: providerEventId,
        event_type: `messages.${providerStatus}`,
        provider_message_id: providerMsgId,
        campaign_id: recipient?.campaign_id || null,
        campaign_recipient_id: recipient?.id || null,
        payload_hash: payloadHash,
        received_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
        processing_status: (recipient ? 'PROCESSED' : 'UNMATCHED') as any,
        processing_error: recipient ? null : 'No matching recipient found for provider message ID',
        retry_count: 0,
      };
      store.webhook_events.push(webhookRecord);

      if (!recipient) {
        logger.warn('WEBHOOK_UNMATCHED_RECIPIENT', `No recipient found matching provider message ID ${providerMsgId}`, {
          details: { provider_message_id: providerMsgId }
        });
        continue;
      }

      // 3. Map to canonical lifecycle status
      let newStatus: LifecycleStatus = 'SENT';
      let eventType: EventType = 'SENT';

      if (providerStatus === 'delivered') {
        newStatus = 'DELIVERED';
        eventType = 'DELIVERED';
      } else if (providerStatus === 'read') {
        newStatus = 'READ';
        eventType = 'READ';
      } else if (providerStatus === 'failed') {
        newStatus = 'FAILED';
        eventType = 'FAILED';
      }

      // Ensure we don't regress state (e.g. delivered after read)
      const rankMap: Record<string, number> = {
        SUBMITTED_TO_PROVIDER: 1,
        ACCEPTED: 2,
        SENT: 3,
        DELIVERED: 4,
        READ: 5,
        FAILED: 6,
      };

      if ((rankMap[recipient.status] || 0) < (rankMap[newStatus] || 0) || newStatus === 'FAILED') {
        await MessageLifecycleService.recordTransition({
          recipientId: recipient.id,
          campaignId: recipient.campaign_id,
          correlationId: recipient.correlation_id,
          eventType,
          newStatus,
          providerMessageId: providerMsgId,
          providerEventId,
          providerTimestamp: new Date(parseInt(st.timestamp, 10) * 1000).toISOString(),
          providerErrorCode: st.errors?.[0]?.code ? String(st.errors[0].code) : undefined,
          providerErrorMessage: st.errors?.[0]?.message,
        });
      }

      processedCount++;
    }

    commitStoreMutation();
    return { processed: processedCount, duplicates: duplicateCount };
  }
}
