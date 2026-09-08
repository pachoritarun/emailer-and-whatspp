import test from 'node:test';
import assert from 'node:assert';
import { MysqlMessageQueue } from '../queue/mysql-queue.js';
import { getMemoryStore } from '../db/pool.js';

test('Queue Concurrency & Worker Crash Recovery', async () => {
  const store = getMemoryStore();
  const campaignId = 'CMP-CRASH-TEST';

  // 1. Enqueue 2 jobs
  await MysqlMessageQueue.enqueueBatch(campaignId, [
    { recipientId: 'RECIP-CRASH-01', correlationId: 'CORR-CRASH-01', priority: 20 },
    { recipientId: 'RECIP-CRASH-02', correlationId: 'CORR-CRASH-02', priority: 10 }
  ]);

  // 2. Worker 1 claims job (should get priority 20)
  const job1 = await MysqlMessageQueue.claimJob('WORKER-1');
  assert.ok(job1 !== null);
  assert.strictEqual(job1.campaign_recipient_id, 'RECIP-CRASH-01');
  assert.strictEqual(job1.status, 'LOCKED');
  assert.strictEqual(job1.locked_by_worker, 'WORKER-1');

  // 3. Worker 2 claims job concurrently (must SKIP LOCKED and get priority 10)
  const job2 = await MysqlMessageQueue.claimJob('WORKER-2');
  assert.ok(job2 !== null);
  assert.strictEqual(job2.campaign_recipient_id, 'RECIP-CRASH-02');
  assert.strictEqual(job2.status, 'LOCKED');
  assert.strictEqual(job2.locked_by_worker, 'WORKER-2');

  // 4. Third attempt returns null because queue is empty
  const job3 = await MysqlMessageQueue.claimJob('WORKER-3');
  assert.strictEqual(job3, null);

  // 5. Simulate Worker 1 crashing: its lock becomes stale (set locked_at to 10 minutes ago)
  const crashedJob = store.message_jobs.find(j => j.id === job1.id);
  assert.ok(crashedJob);
  crashedJob.locked_at = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  // Run Stale Lock Recovery
  const recovered = await MysqlMessageQueue.recoverStaleLocks(5);
  assert.strictEqual(recovered, 1);

  // Assert job is back to QUEUED with incremented retry count
  assert.strictEqual(crashedJob.status, 'QUEUED');
  assert.strictEqual(crashedJob.locked_at, null);
  assert.strictEqual(crashedJob.locked_by_worker, null);
  assert.strictEqual(crashedJob.retry_count, 1);

  // Worker 3 can now claim the recovered job safely
  const jobRecovered = await MysqlMessageQueue.claimJob('WORKER-3');
  assert.ok(jobRecovered !== null);
  assert.strictEqual(jobRecovered.id, crashedJob.id);
  assert.strictEqual(jobRecovered.locked_by_worker, 'WORKER-3');
});
