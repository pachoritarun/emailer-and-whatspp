import { getMemoryStore, commitStoreMutation } from '../db/pool.js';
import { logger } from './logger.js';

export type LifecycleStatus =
  | 'NOT_QUEUED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'SUBMITTED_TO_PROVIDER'
  | 'ACCEPTED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'RETRYING'
  | 'CANCELLED'
  | 'SUPPRESSED'
  | 'SKIPPED';

export type EventType =
  | 'QUEUED'
  | 'PROCESSING'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'RETRY_STARTED'
  | 'RETRY_COMPLETED'
  | 'CANCELLED'
  | 'SUPPRESSED'
  | 'SKIPPED'
  | 'STUCK_TIMEOUT_RECOVERED';

export class MessageLifecycleService {
  /**
   * Transition recipient state, record immutable event, and update campaign counters
   */
  static async recordTransition(params: {
    recipientId: string;
    campaignId: string;
    correlationId: string;
    eventType: EventType;
    newStatus: LifecycleStatus;
    providerMessageId?: string;
    providerEventId?: string;
    providerTimestamp?: string;
    providerErrorCode?: string;
    providerErrorMessage?: string;
    retryable?: boolean;
    retryCount?: number;
    workerId?: string;
  }): Promise<void> {
    const store = getMemoryStore();
    const now = new Date().toISOString();

    const recip = store.campaign_recipients.find(r => r.id === params.recipientId);
    const prevStatus = recip ? recip.status : 'NOT_QUEUED';

    if (recip) {
      recip.status = params.newStatus;
      if (params.providerMessageId) recip.provider_message_id = params.providerMessageId;
      if (params.retryCount !== undefined) recip.retry_count = params.retryCount;
      if (params.providerErrorCode) recip.last_error_code = params.providerErrorCode;
      if (params.providerErrorMessage) recip.last_error_message = params.providerErrorMessage;

      // Update timestamps according to lifecycle
      if (params.newStatus === 'QUEUED') recip.queued_at = now;
      else if (params.newStatus === 'SUBMITTED_TO_PROVIDER') recip.submitted_at = now;
      else if (params.newStatus === 'SENT') recip.sent_at = now;
      else if (params.newStatus === 'DELIVERED') recip.delivered_at = now;
      else if (params.newStatus === 'READ') recip.read_at = now;
      else if (params.newStatus === 'FAILED') recip.failed_at = now;
    }

    // Append to immutable message_events log
    const event = {
      id: store.message_events.length + 1,
      campaign_recipient_id: params.recipientId,
      campaign_id: params.campaignId,
      correlation_id: params.correlationId,
      event_type: params.eventType,
      previous_status: prevStatus,
      new_status: params.newStatus,
      provider_message_id: params.providerMessageId || null,
      provider_event_id: params.providerEventId || null,
      provider_timestamp: params.providerTimestamp || null,
      system_timestamp: now,
      provider_error_code: params.providerErrorCode || null,
      provider_error_message: params.providerErrorMessage || null,
      retryable: params.retryable ? 1 : 0,
      retry_count: params.retryCount || 0,
      worker_id: params.workerId || null,
      created_at: now,
    };
    store.message_events.push(event);

    // Recompute canonical campaign counters (Section 6)
    this.refreshCampaignCounters(params.campaignId);

    commitStoreMutation();

    logger.info('LIFECYCLE_TRANSITION', `Recipient state moved: ${prevStatus} -> ${params.newStatus}`, {
      correlation_id: params.correlationId,
      campaign_id: params.campaignId,
      recipient_id: params.recipientId,
      worker_id: params.workerId,
      details: {
        event_type: params.eventType,
        previous_status: prevStatus,
        new_status: params.newStatus,
        provider_message_id: params.providerMessageId
      }
    });
  }

  /**
   * Recalculate campaign counters from recipient state
   */
  static refreshCampaignCounters(campaignId: string): void {
    const store = getMemoryStore();
    const camp = store.campaigns.find(c => c.id === campaignId);
    if (!camp) return;

    const recips = store.campaign_recipients.filter(r => r.campaign_id === campaignId);
    if (recips.length === 0) return;

    // Reset rollup counters
    camp.queued_count = recips.filter(r => r.status === 'QUEUED').length;
    camp.processing_count = recips.filter(r => r.status === 'PROCESSING').length;
    camp.submitted_count = recips.filter(r =>
      ['SUBMITTED_TO_PROVIDER', 'ACCEPTED', 'SENT', 'DELIVERED', 'READ'].includes(r.status)
    ).length;
    camp.accepted_count = recips.filter(r =>
      ['ACCEPTED', 'SENT', 'DELIVERED', 'READ'].includes(r.status)
    ).length;
    camp.sent_count = recips.filter(r => ['SENT', 'DELIVERED', 'READ'].includes(r.status)).length;
    camp.delivered_count = recips.filter(r =>
      ['DELIVERED', 'READ'].includes(r.status) ||
      (Boolean(r.provider_message_id) && ['SUBMITTED_TO_PROVIDER', 'ACCEPTED', 'SENT'].includes(r.status))
    ).length;
    camp.read_count = recips.filter(r => r.status === 'READ').length;
    camp.failed_count = recips.filter(r => r.status === 'FAILED').length;
    camp.retrying_count = recips.filter(r => r.status === 'RETRYING').length;
    camp.cancelled_count = recips.filter(r => r.status === 'CANCELLED').length;
    camp.skipped_count = recips.filter(r => r.status === 'SKIPPED').length;

    // Transition campaign status to COMPLETED once all message jobs have exited the queue
    if (camp.queued_count === 0 && camp.processing_count === 0 && camp.retrying_count === 0) {
      if (camp.status === 'PROCESSING' || camp.status === 'QUEUED') {
        camp.status = camp.failed_count === recips.length && recips.length > 0 ? 'FAILED' : 'COMPLETED';
        if (!camp.completed_at) {
          camp.completed_at = new Date().toISOString();
        }
      }
    }
  }
}

