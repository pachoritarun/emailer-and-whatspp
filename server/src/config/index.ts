import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

let mysqlHost = process.env.MYSQL_HOST || '127.0.0.1';
let mysqlPort = parseInt(process.env.MYSQL_PORT || '3306', 10);
let mysqlUser = process.env.MYSQL_USER || 'root';
let mysqlPassword = process.env.MYSQL_PASSWORD || '';
let mysqlDatabase = process.env.MYSQL_DATABASE || 'jubot';

if (process.env.DATABASE_URL) {
  try {
    const parsedUrl = new URL(process.env.DATABASE_URL);
    mysqlHost = parsedUrl.hostname || mysqlHost;
    mysqlPort = parsedUrl.port ? parseInt(parsedUrl.port, 10) : mysqlPort;
    mysqlUser = parsedUrl.username || mysqlUser;
    mysqlPassword = decodeURIComponent(parsedUrl.password || mysqlPassword);
    mysqlDatabase = parsedUrl.pathname.replace(/^\//, '') || mysqlDatabase;
  } catch (err) {
    // ignore
  }
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  workerId: process.env.WORKER_INSTANCE_ID || `WORKER-${process.pid}`,
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),

  mysql: {
    host: mysqlHost,
    port: mysqlPort,
    user: mysqlUser,
    password: mysqlPassword,
    database: mysqlDatabase,
    connectionLimit: parseInt(process.env.MYSQL_POOL_LIMIT || '20', 10),
  },

  whatsapp: {
    baseUrl: process.env.WHATSAPP_API_BASE_URL || 'https://graph.facebook.com/v19.0',
    phoneNumberId: process.env.WHATSAPP_PHONE_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || '1133153459884742',
    accessToken: process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || '',
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'uni_webhook_verify_secret_token_9981',
  },

  queue: {
    maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10),
    baseBackoffSeconds: parseInt(process.env.QUEUE_BASE_BACKOFF_SECONDS || '5', 10),
    lockTimeoutSeconds: parseInt(process.env.QUEUE_LOCK_TIMEOUT_SECONDS || '300', 10),
  },

  storage: {
    uploadDir: process.env.UPLOAD_STORAGE_DIR || path.join(process.cwd(), 'data', 'uploads'),
  },

  reconciliation: {
    stuckProcessingMinutes: 10,
    stuckQueuedMinutes: 30,
    missingProviderMinutes: 15,
  }
};
