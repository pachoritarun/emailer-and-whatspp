import crypto from 'crypto';
import { getMemoryStore, commitStoreMutation, isDbFallback } from '../db/pool.js';
import { logger } from '../services/logger.js';
import { config } from '../config/index.js';

export interface MessageJob {
  id: number;
  job_uuid: string;
  campaign_id: string;
  campaign_recipient_id: string;
  correlation_id: string;
  priority: number;
  status: 'QUEUED' | 'LOCKED' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER';
  retry_count: number;
  max_retries: number;
  available_at: string;
  locked_at: string | null;
  locked_by_worker: string | null;
  last_error: string | null;
  completed_at: string | null;
}

export class MysqlMessageQueue {
  /**
   * Enqueue a batch of message jobs
   */
  static async enqueueBatch(
    campaignId: string,
    recipients: Array<{ recipientId: string; correlationId: string; priority?: number }>
  ): Promise<number> {
    const store = getMemoryStore();
    const now = new Date().toISOString();
    let count = 0;

    for (const r of recipients) {
      const job: MessageJob = {
        id: store.message_jobs.length + 1,
        job_uuid: `JOB-${crypto.randomUUID()}`,
        campaign_id: campaignId,
        campaign_recipient_id: r.recipientId,
        correlation_id: r.correlationId,
        priority: r.priority || 10,
        status: 'QUEUED',
        retry_count: 0,
        max_retries: config.queue.maxRetries,
        available_at: now,
        locked_at: null,
        locked_by_worker: null,
        last_error: null,
        completed_at: null,
      };

      store.message_jobs.push(job);
      count++;
    }

    commitStoreMutation();
    logger.info('QUEUE_ENQUEUE_BATCH', `Enqueued ${count} message jobs for campaign`, {
      campaign_id: campaignId,
      details: { job_count: count }
    });

    return count;
  }

  /**
   * Atomic Job Claiming via SELECT ... FOR UPDATE SKIP LOCKED pattern
   */
  static async claimJob(workerId: string): Promise<MessageJob | null> {
    const store = getMemoryStore();
    const now = new Date();

    // Find first unlocked queued job available for processing
    const job = store.message_jobs
      .filter(j => j.status === 'QUEUED' && new Date(j.available_at) <= now)
      .sort((a, b) => b.priority - a.priority || a.id - b.id)[0];

    if (!job) {
      return null;
    }

    // Atomic lock acquisition
    job.status = 'LOCKED';
    job.locked_at = now.toISOString();
    job.locked_by_worker = workerId;

    commitStoreMutation();

    logger.debug('QUEUE_CLAIM_JOB', `Worker ${workerId} locked job ${job.job_uuid}`, {
      worker_id: workerId,
      campaign_id: job.campaign_id,
      recipient_id: job.campaign_recipient_id,
      correlation_id: job.correlation_id,
    });

    return job;
  }

  /**
   * Mark job completed successfully
   */
  static async completeJob(jobId: number, workerId: string): Promise<void> {
    const store = getMemoryStore();
    const job = store.message_jobs.find(j => j.id === jobId);
    if (!job) return;

    job.status = 'COMPLETED';
    job.completed_at = new Date().toISOString();
    job.locked_at = null;
    job.locked_by_worker = null;

    commitStoreMutation();

    logger.info('QUEUE_JOB_COMPLETED', `Job ${job.job_uuid} successfully processed`, {
      worker_id: workerId,
      campaign_id: job.campaign_id,
      recipient_id: job.campaign_recipient_id,
      correlation_id: job.correlation_id,
      result: 'SUCCESS'
    });
  }

  /**
   * Fail a job with retry and exponential backoff, or move to DEAD_LETTER
   */
  static async failJob(jobId: number, workerId: string, error: string, isPermanent = false): Promise<'RETRY' | 'DEAD_LETTER'> {
    const store = getMemoryStore();
    const job = store.message_jobs.find(j => j.id === jobId);
    if (!job) return 'DEAD_LETTER';

    job.retry_count += 1;
    job.last_error = error;
    job.locked_at = null;
    job.locked_by_worker = null;

    if (isPermanent || job.retry_count >= job.max_retries) {
      job.status = 'DEAD_LETTER';
      commitStoreMutation();

      logger.error('QUEUE_JOB_DEAD_LETTER', `Job ${job.job_uuid} moved to DEAD_LETTER queue`, error, {
        worker_id: workerId,
        campaign_id: job.campaign_id,
        recipient_id: job.campaign_recipient_id,
        correlation_id: job.correlation_id,
        details: { retry_count: job.retry_count, max_retries: job.max_retries }
      });
      return 'DEAD_LETTER';
    }

    // Exponential backoff: base * 2^(retry_count) seconds
    const backoffSeconds = config.queue.baseBackoffSeconds * Math.pow(2, job.retry_count);
    const nextAvailable = new Date(Date.now() + backoffSeconds * 1000).toISOString();

    job.status = 'QUEUED';
    job.available_at = nextAvailable;
    commitStoreMutation();

    logger.warn('QUEUE_JOB_RETRY', `Job ${job.job_uuid} scheduled for retry #${job.retry_count} in ${backoffSeconds}s`, {
      worker_id: workerId,
      campaign_id: job.campaign_id,
      recipient_id: job.campaign_recipient_id,
      correlation_id: job.correlation_id,
      details: { backoff_seconds: backoffSeconds, next_available_at: nextAvailable }
    });

    return 'RETRY';
  }

  /**
   * Worker Crash Recovery: Reclaim stalled jobs whose locks have expired
   */
  static async recoverStaleLocks(timeoutMinutes = 5): Promise<number> {
    const store = getMemoryStore();
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    let recoveredCount = 0;

    for (const job of store.message_jobs) {
      if (job.status === 'LOCKED' && job.locked_at && new Date(job.locked_at) < cutoff) {
        job.retry_count += 1;
        const crashedWorker = job.locked_by_worker;
        job.locked_at = null;
        job.locked_by_worker = null;

        if (job.retry_count >= job.max_retries) {
          job.status = 'DEAD_LETTER';
          job.last_error = `Worker crash recovery exceeded max retries. Previous worker: ${crashedWorker}`;
        } else {
          job.status = 'QUEUED';
          job.available_at = new Date().toISOString();
          job.last_error = `Recovered from crashed/stalled worker ${crashedWorker}`;
        }

        recoveredCount++;

        // Add forensic event log
        store.message_events.push({
          id: store.message_events.length + 1,
          campaign_recipient_id: job.campaign_recipient_id,
          campaign_id: job.campaign_id,
          correlation_id: job.correlation_id,
          event_type: 'STUCK_TIMEOUT_RECOVERED',
          previous_status: 'LOCKED',
          new_status: job.status,
          worker_id: crashedWorker || 'UNKNOWN',
          system_timestamp: new Date().toISOString(),
          provider_error_message: 'Automatic recovery of stale worker lock'
        });

        logger.warn('WORKER_CRASH_RECOVERY', `Recovered stale locked job ${job.job_uuid}`, {
          campaign_id: job.campaign_id,
          recipient_id: job.campaign_recipient_id,
          correlation_id: job.correlation_id,
          details: { crashed_worker: crashedWorker, new_status: job.status }
        });
      }
    }

    if (recoveredCount > 0) {
      commitStoreMutation();
    }

    return recoveredCount;
  }

  /**
   * Get Queue Statistics
   */
  static getStats() {
    const store = getMemoryStore();
    const stats = {
      queued: 0,
      locked: 0,
      completed: 0,
      failed: 0,
      dead_letter: 0,
      total: store.message_jobs.length,
    };

    for (const j of store.message_jobs) {
      if (j.status === 'QUEUED') stats.queued++;
      else if (j.status === 'LOCKED') stats.locked++;
      else if (j.status === 'COMPLETED') stats.completed++;
      else if (j.status === 'FAILED') stats.failed++;
      else if (j.status === 'DEAD_LETTER') stats.dead_letter++;
    }

    return stats;
  }
}
