export interface Campaign {
  id: string;
  code: string;
  name: string;
  template_id: string;
  creator_id: string;
  status: 'DRAFT' | 'SCHEDULED' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'PAUSED' | 'CANCELLED' | 'FAILED';
  scheduled_at: string | null;
  launched_at: string | null;
  completed_at: string | null;
  targeted_count: number;
  eligible_count: number;
  suppressed_count: number;
  queued_count: number;
  processing_count: number;
  submitted_count: number;
  accepted_count: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  retrying_count: number;
  cancelled_count: number;
  skipped_count: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignRecipientDetail {
  id: string;
  correlation_id: string;
  contact_id: string;
  recipient_name: string;
  category: string;
  phone_masked: string;
  provider_message_id: string | null;
  status: string;
  raw_status: string;
  submitted_at: string;
  delivered_at: string | null;
  retry_count: number;
}


export interface CampaignSnapshot {
  id: string;
  campaign_id: string;
  campaign_name: string;
  creator_name: string;
  audience_definition: any;
  template_snapshot: any;
  consent_rules: any;
  system_config_version: string;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: 'UTILITY' | 'AUTHENTICATION' | 'MARKETING';
  language: string;
  header_type: string;
  body_text: string;
  footer_text: string | null;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface SystemHealth {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  timestamp: string;
  components: {
    database: { engine: string; status: string; active_connections: number; max_pool_limit: number };
    message_queue: { engine: string; status: string; depth: number; locked: number; completed: number; dead_letter: number; total_jobs: number };
    workers: { service_manager: string; status: string; active_processes: number; active_workers: string[] };
    whatsapp_api: { status: string; endpoint: string; latency_ms: number; rate_limit_remaining: string };
    webhook_endpoint: { status: string; path: string; total_events_ingested: number };
    system_resources: { uptime_seconds: number; memory_rss_mb: number; heap_used_mb: number };
  };
}

export interface DLQItem {
  job_id: number;
  job_uuid: string;
  campaign_id: string;
  campaign_name: string;
  recipient_id: string;
  correlation_id: string;
  retry_count: number;
  max_retries: number;
  last_error: string;
  failure_type: string;
  recommended_action: string;
  failed_at: string;
}

export interface DiagnosticData {
  campaign_id: string;
  code: string;
  name: string;
  status: string;
  launched_at: string;
  snapshot: CampaignSnapshot;
  counters: Record<string, number>;
  failure_breakdown: Record<string, number>;
  stuck_messages: Array<{ recipient_id: string; correlation_id: string; status: string; duration_minutes: number }>;
  timeline: Array<{ timestamp: string; event: string; recipient_id: string; correlation_id: string; details: string }>;
  webhooks: { total_received: number; processed: number; duplicates: number; unmatched: number };
  latest_reconciliation: any;
}

export interface ContactItem {
  id: string;
  external_id: string;
  name: string;
  category: string;
  department: string;
  status: string;
  created_at: string;
}

export interface ImportLog {
  id: string;
  import_code: string;
  filename: string;
  uploader_id: string;
  file_size_bytes: number;
  rows_detected: number;
  rows_processed: number;
  rows_imported: number;
  rows_rejected: number;
  invalid_phone_records: number;
  invalid_category_records: number;
  processing_duration_ms: number;
  status: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id: string;
  user_role: string;
  action: string;
  entity: string;
  entity_id: string;
  ip_address: string;
  user_agent: string;
  success: number;
  reason: string | null;
  metadata: any;
  created_at: string;
}
