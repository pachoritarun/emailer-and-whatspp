# University Enterprise WhatsApp Communication Portal & Forensic Observability System

An institutional WhatsApp broadcast, campaign management, and forensic tracking system engineered specifically for university enterprise infrastructure (100,000 to 500,000+ contacts).

---

## 1. Visual Identity & Brand Design System
The entire application strictly adheres to the **White + Red + Black** university visual identity:
- **White (`#FFFFFF`)**: Primary background, cards, tables, navigation surfaces.
- **Black (`#111111`) / Secondary Black (`#1F1F1F`)**: Headings, typography, high-contrast borders.
- **Institutional Red (`#B00020`) & Dark Red (`#8B0018`)**: Primary action buttons, active navigation indicators, key accents.
- **Light Gray (`#F7F7F7`) & Border Gray (`#E5E5E5`)**: Hairline borders, table headers, alternating rows.
- **Zero Privacy Leakage**: Phone numbers are strictly redacted and never displayed in UI tables, logs, error dumps, URLs, or query parameters.

---

## 2. Linux Native Production Architecture (Zero Docker / Zero Redis)
The system runs natively on university-owned Linux servers (Ubuntu / RHEL / Rocky Linux):

```
                                  INTERNET
                                     │
                     ┌───────────────▼───────────────┐
                     │         NGINX Reverse         │
                     │       Proxy & SSL (443)       │
                     └───────┬───────────────┬───────┘
                             │               │
                 Static / UI │               │ /api & /webhook
                             │               │
              ┌──────────────▼──────┐ ┌──────▼─────────────────────┐
              │ university-portal-  │ │ university-portal-api       │
              │ web.service         │ │ .service (Node.js REST)     │
              │ (Port 3000 / Static)│ └──────────────┬──────────────┘
              └─────────────────────┘                │
                                     ┌───────────────┴───────────────┐
                                     │                               │
                      ┌──────────────▼──────────────┐ ┌──────────────▼──────────────┐
                      │ university-portal-worker@   │ │ university-portal-          │
                      │ .service (Workers 1..N)     │ │ reconciliation.service      │
                      └──────────────┬──────────────┘ └──────────────┬──────────────┘
                                     │                               │
                                     └───────────────┬───────────────┘
                                                     │
                                       ┌─────────────▼─────────────┐
                                       │        MySQL 8.x          │
                                       │ Primary System of Record  │
                                       │  - message_jobs (Queue)   │
                                       │  - message_events (Audit) │
                                       │  - campaigns & snapshots  │
                                       └───────────────────────────┘
```

### Systemd Process Management
Configured in `deploy/systemd/`:
- `university-portal-api.service`: Core REST API & Webhook Ingestion
- `university-portal-worker@.service`: Multi-instance Queue Worker (`systemctl start university-portal-worker@{1..4}`)
- `university-portal-reconciliation.service` & `.timer`: Scheduled reconciliation auditor running every 5 minutes
- `university-portal-web.service`: Frontend UI production service

All services configure `Restart=always` and `RestartSec=5` for automated crash resilience.

---

## 3. MySQL 8-Backed Durable Message Queue
Completely replaces Redis and BullMQ using native InnoDB transactional row locking:
```sql
START TRANSACTION;
SELECT id, job_uuid, campaign_id, campaign_recipient_id, retry_count
FROM message_jobs
WHERE status = 'QUEUED' AND available_at <= NOW(3)
ORDER BY priority DESC, id ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;

UPDATE message_jobs
SET status = 'LOCKED', locked_at = NOW(3), locked_by_worker = ?
WHERE id = ?;
COMMIT;
```

### Worker Crash Recovery
If a worker crashes or is terminated (`kill -9`), its job lock expires (`locked_at < NOW() - 5 MINUTE`). The reconciliation service automatically re-queues the job or moves it to the Dead-Letter Queue (`DEAD_LETTER`) if maximum retries (3) are exceeded.

---

## 4. Forensic Observability & Compliance (Sections 1–27)
1. **Message Lifecycle State Machine**: 10 timestamped states (`QUEUED` → `PROCESSING` → `SUBMITTED_TO_PROVIDER` → `ACCEPTED` → `SENT` → `DELIVERED` → `READ`).
2. **Immutable Event Log (`message_events`)**: Dedicated audit log capturing state transitions, provider message IDs, error codes, and worker IDs.
3. **Idempotent Webhooks (`webhook_events`)**: SHA-256 payload hashing prevents duplicate status updates.
4. **Immutable Campaign Snapshots**: Full freeze of audience filters, template text, variables, and consent rules at launch.
5. **Forensic Reconciliation Engine**: Detects stuck jobs (`PROCESSING > 10m`, `QUEUED > 30m`), unconfirmed provider submissions, and counter mismatches.
6. **Dead-Letter Queue (DLQ)**: Admin console with manual Retry and Ignore capabilities.
7. **End-to-End Correlation Tracer**: Search by Correlation ID, Recipient UUID, or Provider ID to trace all 7 operational layers.

---

## 5. Quickstart & Verification

### Running Automated Test Suite
From the `server/` directory:
```bash
cd server
npm test
```
Verifies:
- Complete sequential lifecycle transitions (`QUEUED` → `DELIVERED` → `READ`)
- Strict privacy filter and phone number redaction
- Queue concurrency row-locking (`SKIP LOCKED`)
- Worker crash recovery
- Webhook idempotency and duplicate deduplication
- Forensic reconciliation discrepancy detection

### Running the Services Locally
1. Start the API Server:
   ```bash
   cd server
   npm run start
   ```
2. Start the Native Queue Worker:
   ```bash
   cd server
   npm run worker
   ```
3. Start the Frontend Application:
   ```bash
   cd client
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.
