import test from 'node:test';
import assert from 'node:assert';
import { ReconciliationService } from '../services/reconciliation.js';
import { getMemoryStore } from '../db/pool.js';

test('Reconciliation Engine: Discrepancy detection and report generation', async () => {
  const store = getMemoryStore();
  const campaignId = 'CMP-RECON-AUDIT-01';

  // Create campaign with intentional counter discrepancy
  store.campaigns.push({
    id: campaignId,
    code: campaignId,
    name: 'Examination Schedule Notice',
    template_id: 'TPL-EXAM-REM',
    creator_id: 'USR-001',
    status: 'PROCESSING',
    targeted_count: 10,
    eligible_count: 10,
    suppressed_count: 0,
    queued_count: 5, // Discrepancy: will actually have 1 queued
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

  // Recipient 1: Submitted but missing provider message ID
  store.campaign_recipients.push({
    id: 'RECIP-RECON-01',
    campaign_id: campaignId,
    contact_id: 'CNT-001',
    correlation_id: 'CORR-RECON-01',
    status: 'SUBMITTED_TO_PROVIDER',
    provider_message_id: null, // Discrepancy
    retry_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  // Recipient 2: Stuck in PROCESSING for 20 minutes
  const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  store.campaign_recipients.push({
    id: 'RECIP-RECON-02',
    campaign_id: campaignId,
    contact_id: 'CNT-002',
    correlation_id: 'CORR-RECON-02',
    status: 'PROCESSING',
    provider_message_id: null,
    retry_count: 0,
    created_at: twentyMinAgo,
    updated_at: twentyMinAgo
  });

  // Run Reconciliation
  const report = await ReconciliationService.reconcileCampaign(campaignId, 'AUTOMATED_UNIT_TEST');

  assert.ok(report.id.startsWith('REC-'));
  assert.strictEqual(report.campaign_id, campaignId);
  assert.ok(report.missing_provider_confirmations >= 1);
  assert.ok(report.stuck_in_processing >= 1);
  assert.ok(report.counter_discrepancies >= 1);
  assert.ok(report.details.discrepancies.length >= 2);
  assert.ok(report.details.recommendations.length >= 1);
});
