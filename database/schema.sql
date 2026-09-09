-- =====================================================================
-- UNIVERSITY ENTERPRISE COMMUNICATION PORTAL
-- PRODUCTION MYSQL 8.X DATABASE DDL SCHEMA
-- Optimized for 100,000 to 500,000+ Contacts & High-Volume Messaging
-- =====================================================================
-- Ensure database exists and is selected
CREATE DATABASE IF NOT EXISTS Communication_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE Communication_DB;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS message_events;
DROP TABLE IF EXISTS webhook_events;
DROP TABLE IF EXISTS message_jobs;
DROP TABLE IF EXISTS campaign_recipients;
DROP TABLE IF EXISTS campaign_snapshots;
DROP TABLE IF EXISTS campaigns;
DROP TABLE IF EXISTS contact_consent;
DROP TABLE IF EXISTS suppression_list;
DROP TABLE IF EXISTS import_logs;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS message_templates;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS reconciliation_reports;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 1. ACCESS CONTROL & USER MANAGEMENT (RBAC)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'SENDER',
    full_name VARCHAR(150) NOT NULL,
    must_change_credentials TINYINT(1) NOT NULL DEFAULT 1,
    department_id VARCHAR(36) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until DATETIME NULL,
    last_login_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_user_username (username),
    INDEX idx_user_role (role),
    INDEX idx_user_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roles (
    id VARCHAR(36) PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_roles (
    user_id VARCHAR(36) NOT NULL,
    role_id VARCHAR(36) NOT NULL,
    assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. INSTITUTIONAL METADATA (Departments, Categories, Courses)
-- ---------------------------------------------------------------------
CREATE TABLE departments (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categories (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE, -- e.g. STUDENT, FACULTY, STAFF, ALUMNI
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE courses (
    id VARCHAR(36) PRIMARY KEY,
    department_id VARCHAR(36) NOT NULL,
    code VARCHAR(30) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    CONSTRAINT fk_course_dept FOREIGN KEY (department_id) REFERENCES departments(id),
    INDEX idx_course_dept (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3. CONTACT MANAGEMENT (Tokenized & Encrypted at rest)
-- Note: Phone numbers are stored hashed/tokenized. NEVER returned in logs or public UI.
-- ---------------------------------------------------------------------
CREATE TABLE contacts (
    id VARCHAR(36) PRIMARY KEY,
    external_identifier VARCHAR(100) NOT NULL UNIQUE, -- e.g. Student ID: STU-2024-001 or Staff ID
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    category_id VARCHAR(36) NOT NULL,
    department_id VARCHAR(36) NULL,
    phone_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash for deduplication
    phone_encrypted VARBINARY(255) NOT NULL, -- AES-256 encrypted phone number
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_contact_cat FOREIGN KEY (category_id) REFERENCES categories(id),
    CONSTRAINT fk_contact_dept FOREIGN KEY (department_id) REFERENCES departments(id),
    INDEX idx_contact_cat (category_id),
    INDEX idx_contact_dept (department_id),
    INDEX idx_contact_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contact_consent (
    id VARCHAR(36) PRIMARY KEY,
    contact_id VARCHAR(36) NOT NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP',
    status ENUM('OPTED_IN', 'OPTED_OUT', 'REVOKED') NOT NULL DEFAULT 'OPTED_IN',
    consent_source VARCHAR(100) NOT NULL, -- e.g. ENROLLMENT_FORM, PORTAL_SETTINGS
    consent_timestamp DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    audit_ref VARCHAR(100) NULL,
    CONSTRAINT fk_consent_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    INDEX idx_consent_contact (contact_id, channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE suppression_list (
    id VARCHAR(36) PRIMARY KEY,
    phone_hash VARCHAR(64) NOT NULL UNIQUE,
    reason VARCHAR(100) NOT NULL, -- USER_OPTOUT, HARD_BOUNCE, COMPLAINT
    added_by VARCHAR(36) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_suppression_hash (phone_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. MESSAGE TEMPLATES (Meta / WhatsApp Cloud API Approved)
-- ---------------------------------------------------------------------
CREATE TABLE message_templates (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    meta_template_id VARCHAR(100) NULL,
    category ENUM('UTILITY', 'AUTHENTICATION', 'MARKETING') NOT NULL DEFAULT 'UTILITY',
    language VARCHAR(10) NOT NULL DEFAULT 'en_US',
    header_type ENUM('NONE', 'TEXT', 'IMAGE', 'DOCUMENT') NOT NULL DEFAULT 'NONE',
    body_text TEXT NOT NULL,
    footer_text VARCHAR(255) NULL,
    sample_variables JSON NULL,
    status ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    created_by VARCHAR(36) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_template_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5. CAMPAIGNS & IMMUTABLE CAMPAIGN SNAPSHOTS
-- ---------------------------------------------------------------------
CREATE TABLE campaigns (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE, -- e.g. CMP-20260907-000123
    name VARCHAR(200) NOT NULL,
    template_id VARCHAR(36) NOT NULL,
    creator_id VARCHAR(36) NOT NULL,
    status ENUM('DRAFT', 'SCHEDULED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'PAUSED', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    scheduled_at DATETIME(3) NULL,
    launched_at DATETIME(3) NULL,
    completed_at DATETIME(3) NULL,
    
    -- Canonical Counter Rollups (Section 6)
    targeted_count INT NOT NULL DEFAULT 0,
    eligible_count INT NOT NULL DEFAULT 0,
    suppressed_count INT NOT NULL DEFAULT 0,
    queued_count INT NOT NULL DEFAULT 0,
    processing_count INT NOT NULL DEFAULT 0,
    submitted_count INT NOT NULL DEFAULT 0,
    accepted_count INT NOT NULL DEFAULT 0,
    sent_count INT NOT NULL DEFAULT 0,
    delivered_count INT NOT NULL DEFAULT 0,
    read_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    retrying_count INT NOT NULL DEFAULT 0,
    cancelled_count INT NOT NULL DEFAULT 0,
    skipped_count INT NOT NULL DEFAULT 0,
    
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_campaign_template FOREIGN KEY (template_id) REFERENCES message_templates(id),
    CONSTRAINT fk_campaign_creator FOREIGN KEY (creator_id) REFERENCES users(id),
    INDEX idx_campaign_status (status),
    INDEX idx_campaign_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_snapshots (
    id VARCHAR(36) PRIMARY KEY,
    campaign_id VARCHAR(36) NOT NULL UNIQUE,
    campaign_name VARCHAR(200) NOT NULL,
    creator_name VARCHAR(150) NOT NULL,
    audience_definition JSON NOT NULL,
    template_snapshot JSON NOT NULL, -- Template ID, version, text, category, variables
    consent_rules JSON NOT NULL,
    system_config_version VARCHAR(50) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_snap_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6. CAMPAIGN RECIPIENTS (Message Lifecycle Core - Section 1)
-- ---------------------------------------------------------------------
CREATE TABLE campaign_recipients (
    id VARCHAR(36) PRIMARY KEY,
    campaign_id VARCHAR(36) NOT NULL,
    contact_id VARCHAR(36) NOT NULL,
    correlation_id VARCHAR(64) NOT NULL,
    status ENUM(
        'NOT_QUEUED',
        'QUEUED',
        'PROCESSING',
        'SUBMITTED_TO_PROVIDER',
        'ACCEPTED',
        'SENT',
        'DELIVERED',
        'READ',
        'FAILED',
        'RETRYING',
        'CANCELLED',
        'SUPPRESSED',
        'SKIPPED'
    ) NOT NULL DEFAULT 'NOT_QUEUED',
    provider_message_id VARCHAR(100) NULL, -- WhatsApp wamid.xxx
    retry_count INT NOT NULL DEFAULT 0,
    last_error_code VARCHAR(50) NULL,
    last_error_message VARCHAR(500) NULL,
    queued_at DATETIME(3) NULL,
    submitted_at DATETIME(3) NULL,
    sent_at DATETIME(3) NULL,
    delivered_at DATETIME(3) NULL,
    read_at DATETIME(3) NULL,
    failed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_recip_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_recip_contact FOREIGN KEY (contact_id) REFERENCES contacts(id),
    INDEX idx_recip_camp_stat (campaign_id, status),
    INDEX idx_recip_prov_msg (provider_message_id),
    INDEX idx_recip_corr (correlation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 7. MYSQL 8-BACKED MESSAGE QUEUE (Replaces Redis / BullMQ)
-- Supports SELECT ... FOR UPDATE SKIP LOCKED
-- ---------------------------------------------------------------------
CREATE TABLE message_jobs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    job_uuid VARCHAR(36) NOT NULL UNIQUE,
    campaign_id VARCHAR(36) NOT NULL,
    campaign_recipient_id VARCHAR(36) NOT NULL,
    correlation_id VARCHAR(64) NOT NULL,
    priority INT NOT NULL DEFAULT 10,
    status ENUM('QUEUED', 'LOCKED', 'COMPLETED', 'FAILED', 'DEAD_LETTER') NOT NULL DEFAULT 'QUEUED',
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    available_at DATETIME(3) NOT NULL,
    locked_at DATETIME(3) NULL,
    locked_by_worker VARCHAR(64) NULL,
    last_error VARCHAR(500) NULL,
    completed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_job_recipient FOREIGN KEY (campaign_recipient_id) REFERENCES campaign_recipients(id) ON DELETE CASCADE,
    INDEX idx_job_claim (status, available_at, priority DESC),
    INDEX idx_job_worker_timeout (status, locked_at),
    INDEX idx_job_campaign (campaign_id),
    INDEX idx_job_recipient (campaign_recipient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 8. IMMUTABLE MESSAGE EVENT LOG (Section 2)
-- ---------------------------------------------------------------------
CREATE TABLE message_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    campaign_recipient_id VARCHAR(36) NOT NULL,
    campaign_id VARCHAR(36) NOT NULL,
    correlation_id VARCHAR(64) NOT NULL,
    event_type ENUM(
        'QUEUED',
        'PROCESSING',
        'SUBMITTED',
        'ACCEPTED',
        'SENT',
        'DELIVERED',
        'READ',
        'FAILED',
        'RETRY_STARTED',
        'RETRY_COMPLETED',
        'CANCELLED',
        'SUPPRESSED',
        'SKIPPED',
        'STUCK_TIMEOUT_RECOVERED'
    ) NOT NULL,
    previous_status VARCHAR(50) NULL,
    new_status VARCHAR(50) NOT NULL,
    provider_message_id VARCHAR(100) NULL,
    provider_event_id VARCHAR(100) NULL,
    provider_timestamp DATETIME(3) NULL,
    system_timestamp DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    provider_error_code VARCHAR(50) NULL,
    provider_error_message VARCHAR(500) NULL,
    retryable TINYINT(1) NOT NULL DEFAULT 0,
    retry_count INT NOT NULL DEFAULT 0,
    worker_id VARCHAR(64) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_me_recipient (campaign_recipient_id),
    INDEX idx_me_campaign (campaign_id),
    INDEX idx_me_prov_id (provider_message_id),
    INDEX idx_me_correlation (correlation_id),
    INDEX idx_me_event_type (event_type),
    INDEX idx_me_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 9. WEBHOOK EVENTS LOG (Section 4 - Idempotent Ingestion)
-- ---------------------------------------------------------------------
CREATE TABLE webhook_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    provider_event_id VARCHAR(100) NOT NULL UNIQUE,
    event_type VARCHAR(50) NOT NULL,
    provider_message_id VARCHAR(100) NULL,
    campaign_id VARCHAR(36) NULL,
    campaign_recipient_id VARCHAR(36) NULL,
    payload_hash CHAR(64) NOT NULL, -- SHA-256 for idempotency validation
    received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    processed_at DATETIME(3) NULL,
    processing_status ENUM('PENDING', 'PROCESSED', 'DUPLICATE', 'FAILED', 'UNMATCHED') NOT NULL DEFAULT 'PENDING',
    processing_error VARCHAR(500) NULL,
    retry_count INT NOT NULL DEFAULT 0,
    INDEX idx_wh_prov_msg (provider_message_id),
    INDEX idx_wh_hash (payload_hash),
    INDEX idx_wh_status (processing_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 10. AUDIT LOGS (Section 11 - Immutable Administrative Trail)
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NULL,
    user_role VARCHAR(50) NOT NULL,
    action VARCHAR(80) NOT NULL,
    entity VARCHAR(80) NOT NULL,
    entity_id VARCHAR(100) NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent VARCHAR(255) NULL,
    success TINYINT(1) NOT NULL DEFAULT 1,
    reason VARCHAR(255) NULL,
    metadata JSON NULL, -- Must NEVER contain phone numbers or secrets
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 11. EXCEL IMPORT LOGS (Section 12 - IMP-YYYYMMDD-XXXXXX)
-- ---------------------------------------------------------------------
CREATE TABLE import_logs (
    id VARCHAR(36) PRIMARY KEY,
    import_code VARCHAR(50) NOT NULL UNIQUE, -- e.g. IMP-20260907-000045
    filename VARCHAR(255) NOT NULL,
    uploader_id VARCHAR(36) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    rows_detected INT NOT NULL DEFAULT 0,
    rows_processed INT NOT NULL DEFAULT 0,
    rows_imported INT NOT NULL DEFAULT 0,
    rows_updated INT NOT NULL DEFAULT 0,
    rows_duplicated INT NOT NULL DEFAULT 0,
    rows_rejected INT NOT NULL DEFAULT 0,
    invalid_phone_records INT NOT NULL DEFAULT 0,
    invalid_category_records INT NOT NULL DEFAULT 0,
    missing_required_fields INT NOT NULL DEFAULT 0,
    processing_duration_ms INT NOT NULL DEFAULT 0,
    status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    error_report_path VARCHAR(255) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_import_user FOREIGN KEY (uploader_id) REFERENCES users(id),
    INDEX idx_import_code (import_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 12. FORENSIC RECONCILIATION REPORTS (Section 7)
-- ---------------------------------------------------------------------
CREATE TABLE reconciliation_reports (
    id VARCHAR(36) PRIMARY KEY,
    campaign_id VARCHAR(36) NOT NULL,
    run_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM_TIMER',
    targeted_count INT NOT NULL,
    eligible_count INT NOT NULL,
    queued_count INT NOT NULL,
    submitted_count INT NOT NULL,
    sent_count INT NOT NULL,
    delivered_count INT NOT NULL,
    read_count INT NOT NULL,
    failed_count INT NOT NULL,
    missing_provider_confirmations INT NOT NULL DEFAULT 0,
    stuck_in_processing INT NOT NULL DEFAULT 0,
    duplicate_webhooks_detected INT NOT NULL DEFAULT 0,
    counter_discrepancies INT NOT NULL DEFAULT 0,
    details JSON NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_recon_camp FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    INDEX idx_recon_camp (campaign_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 13. SYSTEM SETTINGS & RETENTION POLICIES (Sections 17 & 18)
-- ---------------------------------------------------------------------
CREATE TABLE system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    description VARCHAR(255) NULL,
    updated_by VARCHAR(36) NULL,
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
