-- =====================================================================
-- UNIVERSITY ENTERPRISE COMMUNICATION PORTAL
-- INITIAL SEED DATA FOR PRODUCTION / STAGING
-- =====================================================================
-- Ensure database exists and is selected
CREATE DATABASE IF NOT EXISTS Communication_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE Communication_DB;

-- Roles
INSERT INTO roles (id, role_name, description) VALUES
('ROLE-SUPERADMIN', 'Super Administrator', 'Full institutional authority, system configuration, and audit access'),
('ROLE-COMM-ADMIN', 'Communications Officer', 'Campaign creation, audience segmentation, and template management'),
('ROLE-DEPT-HEAD', 'Department Head', 'Departmental campaign authorizer and report viewer'),
('ROLE-AUDITOR', 'Forensic Auditor', 'Read-only access to audit logs, diagnostic traces, and compliance reports')
ON DUPLICATE KEY UPDATE role_name=VALUES(role_name);

-- Users (Initial Encrypted Developer & Sender Accounts)
INSERT INTO users (id, username, email, password_hash, salt, role, full_name, must_change_credentials, is_active) VALUES
('USR-DEV-001', 'Developer', 'developer@jecrcu.edu.in', 'de3854b62ad37e827d3cdc8063bd2c9efacfd8350b28c66a05d7dc4f257e800846fd0b2b5ddddad4599b9d3267ca8485d3cffaa3a1a35506c9039dfb81166f5a', 'c1bfe8aac6b374bbc27d537c50cbf9f41529adcff4f667ebbd336a56b1ed1a6b', 'DEVELOPER', 'System Developer & Forensics Admin', 1, 1),
('USR-SENDER-001', 'Sender', 'sender@jecrcu.edu.in', '943605fabc0d6ae5f3bff120563d1a94f8d9786272e364538310547035b892358f0cd6d41fb476a53b4f016a5209d951761e13c77e01dbf3c4726118809b31f7', '31a1d4375fe4a6b87d073dd69b88b5dc4a4da02bacca2e38cb617eb1dae2bf90', 'SENDER', 'Official Notice & Broadcast Sender', 1, 1)
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name);

INSERT INTO user_roles (user_id, role_id) VALUES
('USR-DEV-001', 'ROLE-SUPERADMIN'),
('USR-SENDER-001', 'ROLE-COMM-ADMIN')
ON DUPLICATE KEY UPDATE role_id=VALUES(role_id);


-- Departments
INSERT INTO departments (id, code, name) VALUES
('DEP-CS', 'CS', 'Department of Computer Science & Engineering'),
('DEP-MED', 'MED', 'School of Medicine & Health Sciences'),
('DEP-LAW', 'LAW', 'Faculty of Law'),
('DEP-BUS', 'BUS', 'School of Business Administration'),
('DEP-REG', 'REG', 'Office of the University Registrar')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Categories
INSERT INTO categories (id, code, name, description) VALUES
('CAT-STU', 'STUDENT', 'Enrolled Students', 'Undergraduate and postgraduate students currently registered'),
('CAT-FAC', 'FACULTY', 'Academic Faculty', 'Professors, lecturers, and academic researchers'),
('CAT-STF', 'STAFF', 'Administrative Staff', 'University operations, facilities, and administration staff'),
('CAT-ALM', 'ALUMNI', 'Graduated Alumni', 'Verified degree holders and alumni association members')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Message Templates (WhatsApp Meta Approved)
INSERT INTO message_templates (id, name, meta_template_id, category, language, header_type, body_text, footer_text, sample_variables, status, created_by) VALUES
('TPL-GANESH-CHATURTHI', 'ganesh_chaturthi', 'meta_tpl_ganesh_01', 'MARKETING', 'en', 'NONE',
'Warm greetings on Ganesh Chaturthi, {{1}}! May Lord Ganesha shower wisdom, happiness, and prosperity upon you and your family.',
'JECRC University • Official Greetings', '["[Student Name]"]', 'APPROVED', 'USR-001')
ON DUPLICATE KEY UPDATE status=VALUES(status);

-- System Settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('QUEUE_MAX_RETRIES', '3', 'Maximum automatic retry attempts for transient provider failures'),
('LOCK_TIMEOUT_SECONDS', '300', 'Worker job lock timeout in seconds (5 minutes) before re-queueing'),
('RECONCILIATION_INTERVAL_MINUTES', '5', 'Frequency of background reconciliation auditing'),
('STUCK_PROCESSING_THRESHOLD_MINUTES', '10', 'Alert threshold for messages held in PROCESSING state'),
('STUCK_QUEUED_THRESHOLD_MINUTES', '30', 'Alert threshold for messages held in QUEUED state')
ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value);
