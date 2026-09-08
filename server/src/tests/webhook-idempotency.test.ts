import test from 'node:test';
import assert from 'node:assert';
import { WebhookHandlerService } from '../services/webhook-handler.js';
import { getMemoryStore } from '../db/pool.js';

test('Webhook Idempotency: Duplicate webhooks are detected and deduplicated', async () => {
  const store = getMemoryStore();
  const providerMsgId = `wamid.IDEMP_${Date.now()}`;

  // Register recipient matching this provider message id
  store.campaign_recipients.push({
    id: 'RECIP-IDEMP-001',
    campaign_id: 'CMP-20260907-001123',
    contact_id: 'CNT-001',
    correlation_id: 'CORR-IDEMP-01',
    status: 'SUBMITTED_TO_PROVIDER',
    provider_message_id: providerMsgId,
    retry_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const rawPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WH-ENTRY-1',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '123', phone_number_id: '456' },
              statuses: [
                {
                  id: providerMsgId,
                  status: 'delivered',
                  timestamp: '1788776400'
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  // First ingestion: should process
  const result1 = await WebhookHandlerService.processWebhook(rawPayload);
  assert.strictEqual(result1.processed, 1);
  assert.strictEqual(result1.duplicates, 0);

  // Recipient status should be DELIVERED
  const recip = store.campaign_recipients.find(r => r.provider_message_id === providerMsgId);
  assert.strictEqual(recip?.status, 'DELIVERED');

  // Second ingestion: identical payload must be detected as duplicate
  const result2 = await WebhookHandlerService.processWebhook(rawPayload);
  assert.strictEqual(result2.processed, 0);
  assert.strictEqual(result2.duplicates, 1);
});
