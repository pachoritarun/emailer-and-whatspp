import { ReconciliationService } from './reconciliation.js';
import { initDbPool } from '../db/pool.js';
import { logger } from './logger.js';

async function main() {
  await initDbPool();
  logger.info('RECONCILIATION_CRON_START', 'Executing scheduled forensic reconciliation audit');

  try {
    const reports = await ReconciliationService.reconcileAllActive('SYSTEM_TIMER');
    logger.info('RECONCILIATION_CRON_FINISH', `Audited ${reports.length} active campaigns`, {
      details: { audited_count: reports.length }
    });
    process.exit(0);
  } catch (err: any) {
    logger.error('RECONCILIATION_CRON_ERROR', 'Reconciliation job failed', err);
    process.exit(1);
  }
}

main();
