import test from 'node:test';
import assert from 'node:assert';
import { MessageLifecycleService } from '../services/message-lifecycle.js';
import { getMemoryStore } from '../db/pool.js';

test('Message Lifecycle: Full sequential transitions (QUEUED -> DELIVERED -> READ)', async () => {
  const store = getMemoryStore();
  const campaignId = 'CMP-TEST-001';
  const recipientId = 'RECIP-TEST-001';
  const correlationId = 'CORR-TEST-ALPHA';

  // 1. Initialize Recipient
  store.campaign_recipients.push({
    id: recipientId,
    campaign_id: campaignId,
    contact_id: 'CNT-001',
    correlation_id: correlationId,
    status: 'NOT_QUEUED',
    provider_message_id: null,
    retry_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  store.campaigns.push({
    id: campaignId,
    code: campaignId,
    name: 'Test Campaign Lifecycle',
    template_id: 'TPL-EXAM-REM',
    creator_id: 'USR-001',
    status: 'PROCESSING',
    targeted_count: 1,
    eligible_count: 1,
    suppressed_count: 0,
    queued_count: 0,
    processing_count: 0,
    submitted_count: 0,
    accepted_count: 0,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    failed_count: 0,
    retrying_count: 0,
    cancelled_count: 0,
    skipped_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  // 2. Transition to QUEUED
  await MessageLifecycleService.recordTransition({
    recipientId,
    campaignId,
    correlationId,
    eventType: 'QUEUED',
    newStatus: 'QUEUED',
  });

  let recip = store.campaign_recipients.find(r => r.id === recipientId);
  assert.strictEqual(recip?.status, 'QUEUED');

  // 3. Transition to PROCESSING
  await MessageLifecycleService.recordTransition({
    recipientId,
    campaignId,
    correlationId,
    eventType: 'PROCESSING',
    newStatus: 'PROCESSING',
    workerId: 'TEST-WORKER-1'
  });
  recip = store.campaign_recipients.find(r => r.id === recipientId);
  assert.strictEqual(recip?.status, 'PROCESSING');

  // 4. Transition to SUBMITTED_TO_PROVIDER
  const mockProviderId = 'wamid.HBgLMTIzNDU2Nzg5MAAFARI=';
  await MessageLifecycleService.recordTransition({
    recipientId,
    campaignId,
    correlationId,
    eventType: 'SUBMITTED',
    newStatus: 'SUBMITTED_TO_PROVIDER',
    providerMessageId: mockProviderId,
    workerId: 'TEST-WORKER-1'
  });
  recip = store.campaign_recipients.find(r => r.id === recipientId);
  assert.strictEqual(recip?.status, 'SUBMITTED_TO_PROVIDER');
  assert.strictEqual(recip?.provider_message_id, mockProviderId);

  // 5. Transition to DELIVERED
  await MessageLifecycleService.recordTransition({
    recipientId,
    campaignId,
    correlationId,
    eventType: 'DELIVERED',
    newStatus: 'DELIVERED',
    providerMessageId: mockProviderId,
  });
  recip = store.campaign_recipients.find(r => r.id === recipientId);
  assert.strictEqual(recip?.status, 'DELIVERED');

  // 6. Transition to READ
  await MessageLifecycleService.recordTransition({
    recipientId,
    campaignId,
    correlationId,
    eventType: 'READ',
    newStatus: 'READ',
    providerMessageId: mockProviderId,
  });
  recip = store.campaign_recipients.find(r => r.id === recipientId);
  assert.strictEqual(recip?.status, 'READ');

  // 7. Verify all transitions are recorded immutably in message_events
  const events = store.message_events.filter(e => e.campaign_recipient_id === recipientId);
  assert.strictEqual(events.length, 5);
  assert.deepStrictEqual(
    events.map(e => e.event_type),
    ['QUEUED', 'PROCESSING', 'SUBMITTED', 'DELIVERED', 'READ']
  );
});
