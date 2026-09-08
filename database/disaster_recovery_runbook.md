# University Enterprise Communication Portal — Disaster Recovery & Backup Runbook

## 1. Recovery Objectives
- **Authoritative System of Record**: MySQL 8.x
- **Recovery Point Objective (RPO)**: <= 5 minutes (Binlog continuous shipping)
- **Recovery Time Objective (RTO)**: <= 30 minutes for full instance recovery

---

## 2. Backup Strategy

### A. Daily Full Physical Backups (Percona XtraBackup or mysqldump)
Every day at 02:00 UTC, a full non-locking consistent snapshot is generated:
```bash
#!/usr/bin/env bash
BACKUP_DIR="/var/backups/mysql/daily"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "${BACKUP_DIR}"

mysqldump --defaults-file=/etc/mysql/debian.cnf \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --databases university_portal \
  | gzip > "${BACKUP_DIR}/uniportal_${TIMESTAMP}.sql.gz"

# Retention: Keep 30 days locally, replicate to offsite cold storage
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +30 -delete
```

### B. Continuous Binary Log Archival (Point-In-Time Recovery)
MySQL binary logs are enabled in `/etc/mysql/mysql.conf.d/mysqld.cnf`:
```ini
server-id = 1
log_bin = /var/log/mysql/mysql-bin.log
binlog_format = ROW
binlog_expire_logs_seconds = 604800 # 7 days
sync_binlog = 1
innodb_flush_log_at_trx_commit = 1
```

---

## 3. Worker Failure & Crash Recovery Protocol

### A. Zero Queue Loss Design
In accordance with production rules, the message queue runs exclusively in MySQL 8 via the `message_jobs` table using:
```sql
SELECT id, job_uuid, campaign_id, campaign_recipient_id, retry_count
FROM message_jobs
WHERE status = 'QUEUED' AND available_at <= NOW(3)
ORDER BY priority DESC, id ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

### B. Automated Stale Lock Reaper
If a Node.js worker terminates abruptly (`kill -9`, hardware power-loss, or OOM event), the job remains in status `LOCKED`.
Every 2 minutes, the reconciliation service runs:
```sql
UPDATE message_jobs
SET status = IF(retry_count + 1 >= max_retries, 'DEAD_LETTER', 'QUEUED'),
    retry_count = retry_count + 1,
    available_at = DATE_ADD(NOW(3), INTERVAL POW(2, retry_count) * 10 SECOND),
    locked_at = NULL,
    locked_by_worker = NULL,
    last_error = 'Worker timeout or crash detected - re-queued for recovery'
WHERE status = 'LOCKED' AND locked_at < DATE_SUB(NOW(3), INTERVAL 5 MINUTE);
```
Every recovered job logs a `STUCK_TIMEOUT_RECOVERED` event to `message_events`.

---

## 4. Disaster Recovery Procedure (Step-by-Step)

### Step 1: Provision Clean Linux Target Server
Install Ubuntu 22.04 LTS / Rocky Linux 9 and dependencies:
```bash
sudo apt update && sudo apt install -y nginx mysql-server nodejs
```

### Step 2: Restore Database Snapshot
```bash
gunzip < /var/backups/mysql/daily/uniportal_YYYYMMDD_HHMMSS.sql.gz | mysql -u root -p university_portal
```

### Step 3: Apply Binary Logs up to Target Timestamp
```bash
mysqlbinlog --start-datetime="2026-09-07 02:00:00" \
            --stop-datetime="2026-09-07 10:14:59" \
            /var/log/mysql/mysql-bin.000* | mysql -u root -p university_portal
```

### Step 4: Run System Reconciliation
Verify that all campaign counters match physical recipient states and no messages are left stranded:
```bash
cd /opt/university-portal/server
NODE_ENV=production node dist/services/reconciliation-cli.js --audit-all
```

### Step 5: Start systemd Services
```bash
sudo systemctl enable --now university-portal-api.service
sudo systemctl enable --now university-portal-worker@{1..4}.service
sudo systemctl enable --now university-portal-reconciliation.timer
sudo systemctl enable --now university-portal-web.service
sudo systemctl restart nginx
```
