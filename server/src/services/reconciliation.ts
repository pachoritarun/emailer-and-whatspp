import crypto from 'crypto';
import { getMemoryStore, commitStoreMutation } from '../db/pool.js';
import { MessageLifecycleService } from './message-lifecycle.js';
import { MysqlMessageQueue } from '../queue/mysql-queue.js';
import { logger } from './logger.js';
import { config } from '../config/index.js';

export interface ReconciliationReport {
  id: string;
  campaign_id: string;
  campaign_code: string;
  campaign_name: string;
  run_by: string;
  targeted_count: number;
  eligible_count: number;
  queued_count: number;
  submitted_count: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  missing_provider_confirmations: number;
  stuck_in_processing: number;
  stuck_in_queued: number;
  duplicate_webhooks_detected: number;
  counter_discrepancies: number;
  details: {
    discrepancies: string[];
    stuck_recipients: Array<{ recipient_id: string; status: string; duration_minutes: number }>;
    recommendations: string[];
  };
  created_at: string;
}

export class ReconciliationService {
  /**
   * Run full forensic reconciliation on a given campaign
   */
  static async reconcileCampaign(campaignId: string, runBy = 'MANUAL_AUDIT'): Promise<ReconciliationReport> {
    const store = getMemoryStore();
    const campaign = store.campaigns.find(c => c.id === campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const recipients = store.campaign_recipients.filter(r => r.campaign_id === campaignId);
    const events = store.message_events.filter(e => e.campaign_id === campaignId);
    const webhooks = store.webhook_events.filter(w => w.campaign_id === campaignId);

    const discrepancies: string[] = [];
    const stuckRecipients: Array<{ recipient_id: string; status: string; duration_minutes: number }> = [];
    const recommendations: string[] = [];

    const now = Date.now();
    let missingProviderConfirmations = 0;
    let stuckProcessingCount = 0;
    let stuckQueuedCount = 0;

    // 1. Audit Recipient States
    for (const r of recipients) {
      // Check: Marked submitted but no provider message ID
      if (r.status === 'SUBMITTED_TO_PROVIDER' && !r.provider_message_id) {
        missingProviderConfirmations++;
        discrepancies.push(`Recipient ${r.id} marked SUBMITTED_TO_PROVIDER but lacks provider message ID`);
      }

      // Check: Stuck in PROCESSING > 10 min
      if (r.status === 'PROCESSING') {
        const processingStart = new Date(r.updated_at || r.created_at).getTime();
        const durationMin = Math.round((now - processingStart) / 60000);
        if (durationMin > config.reconciliation.stuckProcessingMinutes) {
          stuckProcessingCount++;
          stuckRecipients.push({ recipient_id: r.id, status: 'PROCESSING', duration_minutes: durationMin });
        }
      }

      // Check: Stuck in QUEUED > 30 min
      if (r.status === 'QUEUED') {
        const queuedStart = new Date(r.queued_at || r.created_at).getTime();
        const durationMin = Math.round((now - queuedStart) / 60000);
        if (durationMin > config.reconciliation.stuckQueuedMinutes) {
          stuckQueuedCount++;
          stuckRecipients.push({ recipient_id: r.id, status: 'QUEUED', duration_minutes: durationMin });
        }
      }
    }

    // 2. Audit Duplicate Webhooks
    const webhookHashes = new Set<string>();
    let duplicateWebhooks = 0;
    for (const wh of webhooks) {
      if (webhookHashes.has(wh.payload_hash)) {
        duplicateWebhooks++;
      } else {
        webhookHashes.add(wh.payload_hash);
      }
    }
    if (duplicateWebhooks > 0) {
      discrepancies.push(`${duplicateWebhooks} duplicate webhook deliveries detected in event store`);
    }

    // 3. Counter Verification
    let counterDiscrepancies = 0;
    const actualQueued = recipients.filter(r => r.status === 'QUEUED').length;
    const actualProcessing = recipients.filter(r => r.status === 'PROCESSING').length;
    const actualSubmitted = recipients.filter(r =>
      ['SUBMITTED_TO_PROVIDER', 'ACCEPTED', 'SENT', 'DELIVERED', 'READ'].includes(r.status)
    ).length;
    const actualDelivered = recipients.filter(r => ['DELIVERED', 'READ'].includes(r.status)).length;

    if (campaign.queued_count !== actualQueued) {
      counterDiscrepancies++;
      discrepancies.push(`Campaign queued_count (${campaign.queued_count}) differs from actual (${actualQueued})`);
    }
    if (campaign.submitted_count !== actualSubmitted) {
      counterDiscrepancies++;
      discrepancies.push(`Campaign submitted_count (${campaign.submitted_count}) differs from actual (${actualSubmitted})`);
    }
    if (campaign.delivered_count !== actualDelivered) {
      counterDiscrepancies++;
      discrepancies.push(`Campaign delivered_count (${campaign.delivered_count}) differs from actual (${actualDelivered})`);
    }

    // Formulate actionable recommendations
    if (stuckProcessingCount > 0) {
      recommendations.push(`Execute stale lock recovery to reclaim ${stuckProcessingCount} stalled worker jobs`);
    }
    if (missingProviderConfirmations > 0) {
      recommendations.push(`Query WhatsApp Graph API status endpoint for ${missingProviderConfirmations} unconfirmed submissions`);
    }
    if (counterDiscrepancies > 0) {
      recommendations.push('Synchronize canonical rollups with recipient actuals');
      MessageLifecycleService.refreshCampaignCounters(campaignId);
    }

    // 4. Stale lock recovery across the queue
    const recoveredLocks = await MysqlMessageQueue.recoverStaleLocks();
    if (recoveredLocks > 0) {
      recommendations.push(`Successfully auto-recovered ${recoveredLocks} stale worker locks back to QUEUED`);
    }

    const report: ReconciliationReport = {
      id: `REC-${crypto.randomUUID().substring(0, 8).toUpperCase()}`,
      campaign_id: campaign.id,
      campaign_code: campaign.code,
      campaign_name: campaign.name,
      run_by: runBy,
      targeted_count: campaign.targeted_count,
      eligible_count: campaign.eligible_count,
      queued_count: campaign.queued_count,
      submitted_count: campaign.submitted_count,
      sent_count: campaign.sent_count,
      delivered_count: campaign.delivered_count,
      read_count: campaign.read_count,
      failed_count: campaign.failed_count,
      missing_provider_confirmations: missingProviderConfirmations,
      stuck_in_processing: stuckProcessingCount,
      stuck_in_queued: stuckQueuedCount,
      duplicate_webhooks_detected: duplicateWebhooks,
      counter_discrepancies: counterDiscrepancies,
      details: {
        discrepancies,
        stuck_recipients: stuckRecipients,
        recommendations,
      },
      created_at: new Date().toISOString(),
    };

    store.reconciliation_reports.unshift(report);
    commitStoreMutation();

    logger.info('RECONCILIATION_COMPLETED', `Reconciliation audit completed for campaign ${campaign.code}`, {
      campaign_id: campaignId,
      details: {
        discrepancy_count: discrepancies.length,
        stuck_processing: stuckProcessingCount,
        counter_mismatches: counterDiscrepancies
      }
    });

    return report;
  }

  /**
   * Audit all active campaigns
   */
  static async reconcileAllActive(runBy = 'SYSTEM_TIMER'): Promise<ReconciliationReport[]> {
    const store = getMemoryStore();
    const active = store.campaigns.filter(c => ['QUEUED', 'PROCESSING'].includes(c.status));
    const reports: ReconciliationReport[] = [];

    for (const c of active) {
      const rep = await this.reconcileCampaign(c.id, runBy);
      reports.push(rep);
    }

    return reports;
  }
}
