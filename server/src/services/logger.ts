import { config } from '../config/index.js';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface StructuredLogPayload {
  log_level: LogLevel;
  service?: string;
  operation: string;
  request_id?: string;
  correlation_id?: string;
  user_id?: string;
  campaign_id?: string;
  recipient_id?: string;
  worker_id?: string;
  duration_ms?: number;
  result?: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'SKIPPED';
  error_code?: string;
  message: string;
  details?: Record<string, any>;
}

// Regex patterns to detect and strictly redact any phone numbers or auth secrets
const PHONE_REGEX = /(\+?\d{1,4}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{10,15}/g;
const SECRET_REGEX = /(bearer\s+[a-zA-Z0-9_\-\.]+)|(access_token=[a-zA-Z0-9_\-\.]+)/gi;

export function sanitizePrivacyData(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return obj
      .replace(PHONE_REGEX, '[REDACTED_PHONE]')
      .replace(SECRET_REGEX, '[REDACTED_SECRET]');
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizePrivacyData(item));
  }

  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      // Explicitly block fields that might hold phone or secrets
      if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('msisdn')) {
        cleaned[key] = '[REDACTED_PHONE]';
      } else if (lowerKey.includes('token') || lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('authorization')) {
        cleaned[key] = '[REDACTED_SECRET]';
      } else {
        cleaned[key] = sanitizePrivacyData(value);
      }
    }
    return cleaned;
  }

  return obj;
}

class StructuredLogger {
  private serviceName: string;

  constructor(serviceName = 'uniportal-core') {
    this.serviceName = serviceName;
  }

  private write(payload: StructuredLogPayload) {
    const sanitized = sanitizePrivacyData(payload);
    const entry = {
      timestamp: new Date().toISOString(),
      service: payload.service || this.serviceName,
      environment: config.nodeEnv,
      ...sanitized,
    };

    const json = JSON.stringify(entry);
    if (payload.log_level === 'ERROR' || payload.log_level === 'CRITICAL') {
      process.stderr.write(json + '\n');
    } else {
      process.stdout.write(json + '\n');
    }
  }

  info(operation: string, message: string, meta?: Partial<StructuredLogPayload>) {
    this.write({ log_level: 'INFO', operation, message, ...meta });
  }

  warn(operation: string, message: string, meta?: Partial<StructuredLogPayload>) {
    this.write({ log_level: 'WARN', operation, message, ...meta });
  }

  error(operation: string, message: string, error?: any, meta?: Partial<StructuredLogPayload>) {
    const errorDetails = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;

    this.write({
      log_level: 'ERROR',
      operation,
      message,
      result: 'FAILURE',
      details: { ...meta?.details, error: errorDetails },
      ...meta,
    });
  }

  critical(operation: string, message: string, meta?: Partial<StructuredLogPayload>) {
    this.write({ log_level: 'CRITICAL', operation, message, result: 'FAILURE', ...meta });
  }

  debug(operation: string, message: string, meta?: Partial<StructuredLogPayload>) {
    if (config.nodeEnv === 'development') {
      this.write({ log_level: 'DEBUG', operation, message, ...meta });
    }
  }
}

export const logger = new StructuredLogger();
