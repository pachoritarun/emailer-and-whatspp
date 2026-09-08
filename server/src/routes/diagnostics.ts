import { Router } from 'express';
import { getMemoryStore } from '../db/pool.js';
import { ReconciliationService } from '../services/reconciliation.js';
import { sanitizePrivacyData } from '../services/logger.js';

export const diagnosticsRouter = Router();

// GET /api/diagnostics/campaign/:id - Section 19 Forensic Diagnostic View
diagnosticsRouter.get('/campaign/:id', async (req, res) => {
  const store = getMemoryStore();
  const campaign = store.campaigns.find(c => c.id === req.params.id);

  if (!campaign) {
    return res.status(404).json({ success: false, error: 'Campaign not found' });
  }

  const snapshot = store.campaign_snapshots.find(s => s.campaign_id === campaign.id);
  const recipients = store.campaign_recipients.filter(r => r.campaign_id === campaign.id);
  const events = store.message_events.filter(e => e.campaign_id === campaign.id);
  const webhooks = store.webhook_events.filter(w => w.campaign_id === campaign.id);
  const latestReport = store.reconciliation_reports.find(r => r.campaign_id === campaign.id);

  // Build Execution Timeline
  const timeline = events.slice(0, 50).map(e => ({
    timestamp: e.system_timestamp,
    event: e.event_type,
    recipient_id: e.campaign_recipient_id,
    correlation_id: e.correlation_id,
    details: e.provider_error_message || e.new_status
  }));

  // Failure Taxonomy Breakdown (Section 13)
  const failureBreakdown: Record<string, number> = {};
  for (const r of recipients) {
    if (r.status === 'FAILED' || r.last_error_code) {
      const code = r.last_error_code || 'PROVIDER_UNSPECIFIED';
      failureBreakdown[code] = (failureBreakdown[code] || 0) + 1;
    }
  }

  // Stuck Message Detection (Section 8)
  const now = Date.now();
  const stuckMessages = recipients
    .filter(r => {
      if (r.status === 'PROCESSING') {
        return (now - new Date(r.updated_at || r.created_at).getTime()) > 10 * 60 * 1000;
      }
      if (r.status === 'QUEUED') {
        return (now - new Date(r.queued_at || r.created_at).getTime()) > 30 * 60 * 1000;
      }
      return false;
    })
    .map(r => ({
      recipient_id: r.id,
      correlation_id: r.correlation_id,
      status: r.status,
      duration_minutes: Math.round((now - new Date(r.updated_at || r.created_at).getTime()) / 60000)
    }));

  res.json({
    success: true,
    campaign_id: campaign.id,
    code: campaign.code,
    name: campaign.name,
    status: campaign.status,
    launched_at: campaign.launched_at,
    snapshot,
    counters: {
      targeted: campaign.targeted_count,
      eligible: campaign.eligible_count,
      suppressed: campaign.suppressed_count,
      queued: campaign.queued_count,
      processing: campaign.processing_count,
      submitted: campaign.submitted_count,
      sent: campaign.sent_count,
      delivered: campaign.delivered_count,
      read: campaign.read_count,
      failed: campaign.failed_count,
      retrying: campaign.retrying_count,
    },
    failure_breakdown: failureBreakdown,
    stuck_messages: stuckMessages,
    timeline,
    webhooks: {
      total_received: webhooks.length,
      processed: webhooks.filter(w => w.processing_status === 'PROCESSED').length,
      duplicates: webhooks.filter(w => w.processing_status === 'DUPLICATE').length,
      unmatched: webhooks.filter(w => w.processing_status === 'UNMATCHED').length,
    },
    latest_reconciliation: latestReport || null
  });
});

// POST /api/diagnostics/campaign/:id/reconcile - Trigger manual audit
diagnosticsRouter.post('/campaign/:id/reconcile', async (req, res) => {
  try {
    const report = await ReconciliationService.reconcileCampaign(req.params.id, 'ADMIN_ON_DEMAND');
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/diagnostics/campaign/:id/export - Section 22 Diagnostic Export (Zero phone numbers)
diagnosticsRouter.get('/campaign/:id/export', (req, res) => {
  const store = getMemoryStore();
  const campaign = store.campaigns.find(c => c.id === req.params.id);
  if (!campaign) {
    return res.status(404).json({ success: false, error: 'Campaign not found' });
  }

  const exportPayload = sanitizePrivacyData({
    institution: 'University Enterprise Communication System',
    export_timestamp: new Date().toISOString(),
    campaign_metadata: {
      id: campaign.id,
      code: campaign.code,
      name: campaign.name,
      status: campaign.status,
      launched_at: campaign.launched_at
    },
    counters: {
      targeted: campaign.targeted_count,
      eligible: campaign.eligible_count,
      submitted: campaign.submitted_count,
      delivered: campaign.delivered_count,
      read: campaign.read_count,
      failed: campaign.failed_count
    },
    events_summary: store.message_events
      .filter(e => e.campaign_id === campaign.id)
      .slice(0, 100)
      .map(e => ({
        event_type: e.event_type,
        recipient_id: e.campaign_recipient_id,
        correlation_id: e.correlation_id,
        timestamp: e.system_timestamp,
        error_code: e.provider_error_code
      }))
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="diagnostics_${campaign.code}.json"`);
  res.send(JSON.stringify(exportPayload, null, 2));
});
