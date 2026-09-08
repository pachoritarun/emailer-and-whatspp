import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  Settings,
  Mail,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  EyeOff,
  Download,
  HelpCircle,
  Lock,
  ChevronRight,
  ShieldCheck,
  Users,
  Search,
  Check,
  AlertTriangle,
  BookOpen,
  X
} from 'lucide-react';
import { API_BASE } from '../api/client.js';
import '../styles/emailer.css';

type RecipientRow = {
  name?: string;
  email?: string;
  rollNumber?: string;
  id?: string;
  password?: string;
  [key: string]: any;
};

interface EmailResult {
  email: string;
  success: boolean;
  error?: string;
}

export const EmailerView: React.FC = () => {
  // Navigation & Stepper
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'all' | 'success' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedField, setFocusedField] = useState<'subject' | 'body'>('body');
  const [showPassword, setShowPassword] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Data
  const [data, setData] = useState<RecipientRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);

  // SMTP Settings
  const [smtpConfig, setSmtpConfig] = useState({
    host: 'smtp.gmail.com',
    port: 465,
    user: 'admin@jecrcu.edu.in',
    pass: '',
    from: 'JECRC University Administration <admin@jecrcu.edu.in>',
  });
  const [isVerifyingSmtp, setIsVerifyingSmtp] = useState(false);

  // Email Template
  const [emailTemplate, setEmailTemplate] = useState({
    subject: 'JECRC University - Academic Portal Access Credentials for {{name}}',
    body: `Dear {{name}},

Greetings from JECRC University Administration.

Your official student registration and portal access credentials for the academic session are detailed below:

• Student Name: {{name}}
• Roll Number: {{rollNumber}}
• Student ID: {{id}}
• Portal Login Email: {{email}}
• Temporary Password: {{password}}

Please log in to the official JECRC Student Portal (https://portal.jecrcu.edu.in) to reset your password and complete your registration.

For any academic queries, contact academics@jecrcu.edu.in.

Warm regards,
Office of Academic Affairs
JECRC University, Jaipur`
  });

  // Sending State & Metrics
  const [isSending, setIsSending] = useState(false);
  const [sendResults, setSendResults] = useState<EmailResult[]>([]);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [startTime, setStartTime] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load saved settings from localStorage
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('jecrc_smtpConfig');
      const savedTemplate = localStorage.getItem('jecrc_emailTemplate');
      if (savedConfig) setSmtpConfig(JSON.parse(savedConfig));
      if (savedTemplate) setEmailTemplate(JSON.parse(savedTemplate));
    } catch {
      // ignore
    }
  }, []);

  // Auto-save settings
  useEffect(() => {
    if (smtpConfig.host || smtpConfig.user) {
      localStorage.setItem('jecrc_smtpConfig', JSON.stringify(smtpConfig));
    }
  }, [smtpConfig]);

  useEffect(() => {
    localStorage.setItem('jecrc_emailTemplate', JSON.stringify(emailTemplate));
  }, [emailTemplate]);

  // SMTP Presets
  const applyPreset = (preset: 'jecrc_google' | 'gmail' | 'outlook' | 'custom') => {
    const presets = {
      jecrc_google: { host: 'smtp.gmail.com', port: 465 },
      gmail: { host: 'smtp.gmail.com', port: 465 },
      outlook: { host: 'smtp.office365.com', port: 587 },
      custom: { host: '', port: 465 },
    };
    setSmtpConfig(prev => ({ ...prev, ...presets[preset] }));
    showToast('info', `Applied ${preset.replace('_', ' ').toUpperCase()} preset (Port ${presets[preset].port})`);
  };

  // Verify SMTP Connection
  const handleVerifySmtp = async () => {
    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      showToast('error', 'Please provide SMTP host, username, and password.');
      return;
    }

    setIsVerifyingSmtp(true);
    try {
      const res = await fetch(`${API_BASE}/email/verify-smtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smtpConfig }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', 'SMTP authentication verified successfully!');
      } else {
        showToast('error', data.error || 'SMTP verification failed.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Connection error to SMTP tester.');
    } finally {
      setIsVerifyingSmtp(false);
    }
  };

  // University Template Presets
  const loadUniversityTemplate = (type: 'credentials' | 'exam' | 'fees') => {
    if (type === 'credentials') {
      setEmailTemplate({
        subject: 'JECRC University - Academic Portal Access Credentials for {{name}}',
        body: `Dear {{name}},

Greetings from JECRC University Administration.

Your official student registration and portal access credentials for the academic session are detailed below:

• Student Name: {{name}}
• Roll Number: {{rollNumber}}
• Student ID: {{id}}
• Portal Login Email: {{email}}
• Temporary Password: {{password}}

Please log in to the official JECRC Student Portal to complete your registration.

Warm regards,
Office of Academic Affairs
JECRC University, Jaipur`
      });
    } else if (type === 'exam') {
      setEmailTemplate({
        subject: 'JECRC University - End Semester Examination Notice | {{name}}',
        body: `Dear {{name}},

This is an official communication regarding your upcoming End Semester Examinations at JECRC University.

Candidate Profile:
• Name: {{name}}
• Roll Number: {{rollNumber}}
• Registered Email: {{email}}

Please ensure you carry your official University Identity Card and Hall Ticket to the examination center.

Best of luck,
Controller of Examinations
JECRC University, Jaipur`
      });
    } else if (type === 'fees') {
      setEmailTemplate({
        subject: 'JECRC University - Academic Fee Receipt & Clearance Notice',
        body: `Dear {{name}},

We hereby confirm the receipt of your academic fee submission for student ID: {{id}}.

Registration Details:
• Name: {{name}}
• Roll Number: {{rollNumber}}
• Status: Fee Cleared

Thank you for your prompt clearance.

Finance & Accounts Department
JECRC University, Jaipur`
      });
    }
    showToast('info', 'Loaded official university template!');
  };

  // Insert Variable Tag
  const insertVariable = (varName: string) => {
    const tag = `{{${varName}}}`;
    if (focusedField === 'subject') {
      setEmailTemplate(prev => ({ ...prev, subject: prev.subject + ' ' + tag }));
    } else {
      setEmailTemplate(prev => ({ ...prev, body: prev.body + ' ' + tag }));
    }
    showToast('info', `Inserted ${tag}`);
  };

  // Excel File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];

        if (jsonData.length > 0) {
          setData(jsonData);
          setColumns(Object.keys(jsonData[0]));
          setCurrentStep(2);
          showToast('success', `Loaded ${jsonData.length} student records successfully!`);
          setSendResults([]);
        } else {
          showToast('error', 'The Excel sheet is empty.');
        }
      } catch {
        showToast('error', 'Error reading the Excel file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Direct load from University Recipient Directory
  const handleLoadFromDirectory = async () => {
    setIsLoadingDirectory(true);
    try {
      const res = await fetch(`${API_BASE}/contacts`);
      const json = await res.json();
      if (res.ok && json.contacts) {
        const withEmails = json.contacts.filter((c: any) => c.email && c.email.includes('@'));
        if (withEmails.length === 0) {
          showToast('error', 'No contacts with registered email addresses found in directory.');
          return;
        }
        const mapped = withEmails.map((c: any) => ({
          name: c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim(),
          email: c.email,
          phone: c.phone,
          category: c.category,
          id: c.id
        }));
        setData(mapped);
        setColumns(['name', 'email', 'phone', 'category']);
        setCurrentStep(2);
        showToast('success', `Imported ${mapped.length} recipients directly from University Directory!`);
      } else {
        showToast('error', 'Failed to fetch contacts from directory.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error loading directory.');
    } finally {
      setIsLoadingDirectory(false);
    }
  };

  // Live Preview calculation
  let previewSubject = emailTemplate.subject;
  let previewBody = emailTemplate.body;
  if (data.length > 0) {
    const firstStudent = data[0];
    Object.keys(firstStudent).forEach((key) => {
      const value = String(firstStudent[key] || '');
      const regex = new RegExp(`{{${key}}}`, 'gi');
      previewSubject = previewSubject.replace(regex, value);
      previewBody = previewBody.replace(regex, value);

      // Normalized key without spaces/underscores (e.g. 'Roll Number' -> 'rollnumber')
      const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '');
      const normRegex = new RegExp(`{{${cleanKey}}}`, 'gi');
      previewSubject = previewSubject.replace(normRegex, value);
      previewBody = previewBody.replace(normRegex, value);
    });
  }

  // Dispatch Batch Sending
  const handleSendEmails = async () => {
    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass || !smtpConfig.from) {
      setCurrentStep(2);
      showToast('error', 'Please complete all required SMTP configuration fields.');
      return;
    }
    if (data.length === 0) {
      setCurrentStep(1);
      showToast('error', 'Please upload student data or import from directory first.');
      return;
    }

    setIsSending(true);
    setSendResults([]);
    setProgress({ sent: 0, total: data.length });
    setStartTime(Date.now());

    let accumulatedResults: EmailResult[] = [];
    const BATCH_SIZE = 10;

    try {
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);

        const response = await fetch(`${API_BASE}/send-emails`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: batch,
            smtpConfig,
            emailTemplate,
            useHtml: false,
          }),
        });

        const result = await response.json();

        if (response.ok && result.results) {
          accumulatedResults = [...accumulatedResults, ...result.results];
        } else {
          showToast('error', `Error in batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.error || 'Failed to dispatch'}`);
          break;
        }

        setSendResults(accumulatedResults);
        const newSentCount = Math.min(i + BATCH_SIZE, data.length);
        setProgress({ sent: newSentCount, total: data.length });
      }

      showToast('success', `Dispatch completed! Processed ${accumulatedResults.length} records.`);
    } catch {
      showToast('error', 'An unexpected error occurred during email dispatch.');
    } finally {
      setIsSending(false);
    }
  };

  // Download Report
  const downloadReport = () => {
    if (sendResults.length === 0) return;

    const reportData = data.map((row) => {
      const emailKey = Object.keys(row).find((k) => k.toLowerCase().includes('email'));
      const rowEmail = emailKey ? row[emailKey] : null;
      const result = sendResults.find((r) => r.email === rowEmail);

      return {
        ...row,
        'Dispatch Status': result ? (result.success ? 'Success' : 'Failed') : 'Not Sent',
        'Error Log': result?.error || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'JECRC_Dispatch_Report');
    XLSX.writeFile(wb, `JECRC_Email_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('success', 'Downloaded dispatch Excel report.');
  };

  // Metrics
  const successCount = sendResults.filter((r) => r.success).length;
  const failureCount = sendResults.filter((r) => !r.success).length;
  const inQueueCount = Math.max(0, data.length - progress.sent);
  const elapsedTime = startTime && isSending ? Math.max(1, (Date.now() - startTime) / 1000) : 0;
  const sendSpeed = elapsedTime > 0 ? (progress.sent / elapsedTime).toFixed(1) : '0';
  const estimatedTimeRemaining = isSending && Number(sendSpeed) > 0
    ? Math.ceil(inQueueCount / Number(sendSpeed))
    : 0;

  // Filtered Table Data
  const filteredData = data.filter((row) => {
    const emailKey = Object.keys(row).find((k) => k.toLowerCase().includes('email'));
    const rowEmail = emailKey ? String(row[emailKey] || '') : '';
    const nameVal = row.name ? String(row.name) : '';

    const matchesSearch = rowEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nameVal.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'success') {
      const res = sendResults.find((r) => r.email === rowEmail);
      return res?.success === true;
    }
    if (activeTab === 'failed') {
      const res = sendResults.find((r) => r.email === rowEmail);
      return res?.success === false;
    }
    return true;
  });

  return (
    <div className="emailer-container">
      {/* Dynamic Toast Alert */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          padding: '12px 18px',
          borderRadius: '4px',
          fontSize: '0.84rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          backgroundColor: toastMessage.type === 'success' ? '#16A34A' : toastMessage.type === 'error' ? '#DC2626' : '#1E293B',
          color: '#FFFFFF'
        }}>
          {toastMessage.type === 'success' && <CheckCircle size={16} />}
          {toastMessage.type === 'error' && <AlertTriangle size={16} />}
          {toastMessage.type === 'info' && <ShieldCheck size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Institutional Top Card */}
      <div className="emailer-header-card">
        <div className="emailer-brand-wrap">
          <div className="emailer-logo-badge">
            <img
              src={`${import.meta.env.BASE_URL}jecrc-logo.png`}
              alt="JECRC University Logo"
              className="emailer-logo-img"
              onError={(e) => {
                // Fallback if logo not found
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="emailer-title-block">
            <h2>
              <span>JECRC UNIVERSITY</span>
              <span className="emailer-official-badge">Bulk Email Dispatcher</span>
            </h2>
            <div className="emailer-subtitle">
              <Lock size={13} color="#16A34A" />
              <span>Institutional SMTP Communication • Port 465 SSL Encrypted</span>
            </div>
          </div>
        </div>

        <div className="emailer-header-actions">
          <button
            onClick={() => setShowGuideModal(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
          >
            <HelpCircle size={14} />
            <span>Setup Guide</span>
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            border: '1px solid var(--uni-border-gray)',
            borderRadius: '4px',
            backgroundColor: '#FAFAFA'
          }}>
            <Users size={14} color="#6B6B6B" />
            <span style={{ fontSize: '0.78rem', color: 'var(--uni-muted)' }}>Recipients:</span>
            <strong style={{ fontSize: '0.84rem' }}>{data.length}</strong>
          </div>
        </div>
      </div>

      {/* Live Dispatch Monitor Card */}
      <div className="emailer-monitor-card">
        <div className="emailer-metric-strip">
          <div className="emailer-metric-box">
            <div className="metric-label">
              <span>Total Contacts</span>
              <Users size={14} color="#6B6B6B" />
            </div>
            <div className="metric-value">{data.length}</div>
          </div>

          <div className="emailer-metric-box queue">
            <div className="metric-label">
              <span>In Queue</span>
              <Clock size={14} color="#D97706" />
            </div>
            <div className="metric-value">{inQueueCount}</div>
          </div>

          <div className="emailer-metric-box success">
            <div className="metric-label">
              <span>Dispatched</span>
              <CheckCircle size={14} color="#16A34A" />
            </div>
            <div className="metric-value">{successCount}</div>
          </div>

          <div className="emailer-metric-box failed">
            <div className="metric-label">
              <span>Failed</span>
              <XCircle size={14} color="#DC2626" />
            </div>
            <div className="metric-value">{failureCount}</div>
          </div>
        </div>

        {/* Live Speed & Progress Bar */}
        {(isSending || progress.total > 0) && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--uni-border-gray)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, color: 'var(--uni-black)' }}>
                Dispatch Progress: {progress.sent} / {progress.total} emails
                {isSending && (
                  <span style={{ marginLeft: '12px', color: 'var(--uni-muted)', fontFamily: 'var(--font-mono)' }}>
                    Speed: {sendSpeed} emails/sec | ETA: {estimatedTimeRemaining}s
                  </span>
                )}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--uni-red)', fontFamily: 'var(--font-mono)' }}>
                {Math.round((progress.sent / (progress.total || 1)) * 100)}%
              </span>
            </div>
            <div style={{ height: '8px', backgroundColor: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(progress.sent / (progress.total || 1)) * 100}%`,
                backgroundColor: 'var(--uni-red)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Workflow Stepper Bar */}
      <div className="emailer-stepper-grid">
        {[
          { num: 1, title: '1. Recipient Data', desc: 'Excel or Recipient Directory' },
          { num: 2, title: '2. SMTP Settings', desc: 'Host, Auth & SSL Port 465' },
          { num: 3, title: '3. Template & Tags', desc: 'Compose Official Notice' },
          { num: 4, title: '4. Preview & Dispatch', desc: 'Live Proof & Bulk Send' },
        ].map(step => {
          const isActive = currentStep === step.num;
          const isDone = currentStep > step.num;
          return (
            <button
              key={step.num}
              onClick={() => setCurrentStep(step.num)}
              className={`emailer-step-card ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''}`}
            >
              <div className="emailer-step-num">
                {isDone ? <Check size={14} /> : step.num}
              </div>
              <div>
                <div className="emailer-step-title">{step.title}</div>
                <div className="emailer-step-desc">{step.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main 2-Column Working Area */}
      <div className="emailer-main-grid">
        {/* Left Column: Data & SMTP Authentication */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Step 1: Upload Excel or Load Directory */}
          <div className="uni-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', backgroundColor: '#F1F5F9', borderRadius: '4px' }}>01</span>
                <h3 style={{ margin: 0 }}>Student & Recipient Master Data</h3>
              </div>
              {data.length > 0 && (
                <span className="badge badge-delivered" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle size={12} /> {data.length} Loaded
                </span>
              )}
            </div>

            <div
              className="emailer-dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="emailer-dropzone-icon">
                <Upload size={22} />
              </div>
              <p style={{ fontWeight: 600, fontSize: '0.88rem', margin: 0 }}>Upload Excel / CSV Student File</p>
              <p style={{ fontSize: '0.74rem', color: 'var(--uni-muted)', marginTop: '4px' }}>
                Supports columns: Name, Email, Roll Number, ID, Password
              </p>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                onClick={handleLoadFromDirectory}
                disabled={isLoadingDirectory}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}
              >
                <Users size={14} />
                <span>{isLoadingDirectory ? 'Loading Directory...' : 'Load from University Directory'}</span>
              </button>

              {data.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setData([]);
                    setColumns([]);
                    setSendResults([]);
                  }}
                  style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: '0.76rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Clear Data
                </button>
              )}
            </div>

            {/* Available Columns */}
            {columns.length > 0 && (
              <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--uni-muted)', textTransform: 'uppercase' }}>
                  Detected Columns in File:
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {columns.map(col => (
                    <span key={col} className="emailer-tag-pill" onClick={() => insertVariable(col)}>
                      +{col}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2: University SMTP Auth */}
          <div className="uni-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', backgroundColor: '#F1F5F9', borderRadius: '4px' }}>02</span>
                <h3 style={{ margin: 0 }}>University SMTP Auth</h3>
              </div>
              <span className="badge badge-delivered" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Lock size={12} /> Port {smtpConfig.port} {smtpConfig.port === 465 ? 'SSL' : 'TLS'}
              </span>
            </div>

            {/* Presets */}
            <div className="emailer-preset-group">
              <button
                type="button"
                onClick={() => applyPreset('jecrc_google')}
                className="emailer-preset-btn"
              >
                JECRC Google Workspace
              </button>
              <button
                type="button"
                onClick={() => applyPreset('gmail')}
                className="emailer-preset-btn"
              >
                Standard Gmail
              </button>
              <button
                type="button"
                onClick={() => applyPreset('outlook')}
                className="emailer-preset-btn"
              >
                Microsoft 365
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>SMTP Host</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.82rem' }}
                  value={smtpConfig.host}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                  placeholder="smtp.gmail.com"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>Port</label>
                <input
                  type="number"
                  className="form-control"
                  style={{ fontSize: '0.82rem' }}
                  value={smtpConfig.port}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, port: Number(e.target.value) })}
                  placeholder="465"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>Username / Email</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.82rem' }}
                  value={smtpConfig.user}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                  placeholder="admin@jecrcu.edu.in"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.74rem' }}>App Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control"
                    style={{ fontSize: '0.82rem', paddingRight: '32px' }}
                    value={smtpConfig.pass}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                    placeholder="16-character App Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#6B6B6B'
                    }}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '12px', marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.74rem' }}>From Header</label>
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '0.82rem' }}
                value={smtpConfig.from}
                onChange={(e) => setSmtpConfig({ ...smtpConfig, from: e.target.value })}
                placeholder="JECRC University Administration <admin@jecrcu.edu.in>"
              />
            </div>

            <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleVerifySmtp}
                disabled={isVerifyingSmtp}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}
              >
                <ShieldCheck size={14} />
                <span>{isVerifyingSmtp ? 'Verifying...' : 'Test SMTP Auth'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Template & Live Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Step 3: Template & Tags */}
          <div className="uni-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', backgroundColor: '#F1F5F9', borderRadius: '4px' }}>03</span>
                <h3 style={{ margin: 0 }}>Official Email Template & Dynamic Tags</h3>
              </div>
            </div>

            {/* Template Presets */}
            <div className="emailer-preset-group">
              <button
                type="button"
                onClick={() => loadUniversityTemplate('credentials')}
                className="emailer-preset-btn"
              >
                Portal Credentials
              </button>
              <button
                type="button"
                onClick={() => loadUniversityTemplate('exam')}
                className="emailer-preset-btn"
              >
                Exam Notice
              </button>
              <button
                type="button"
                onClick={() => loadUniversityTemplate('fees')}
                className="emailer-preset-btn"
              >
                Fee Receipt
              </button>
            </div>

            {/* Insert Tag Buttons */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--uni-muted)', textTransform: 'uppercase' }}>
                Click to Insert Dynamic Variable Tag:
              </div>
              <div className="emailer-tag-pills">
                {['name', 'email', 'rollNumber', 'id', 'password'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertVariable(tag)}
                    className="emailer-tag-pill"
                  >
                    +{'{{' + tag + '}}'}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontSize: '0.76rem', fontWeight: 600 }}>Subject Line</label>
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '0.86rem', width: '100%', padding: '10px 12px' }}
                value={emailTemplate.subject}
                onFocus={() => setFocusedField('subject')}
                onChange={(e) => setEmailTemplate({ ...emailTemplate, subject: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ fontSize: '0.76rem', fontWeight: 600, margin: 0 }}>Email Body (Text or HTML)</label>
                <span style={{ fontSize: '0.7rem', color: 'var(--uni-muted)' }}>Resizable • Full Width</span>
              </div>
              <textarea
                className="form-control emailer-body-textarea"
                style={{
                  fontSize: '0.86rem',
                  minHeight: '280px',
                  width: '100%',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  lineHeight: '1.6',
                  padding: '12px 14px'
                }}
                value={emailTemplate.body}
                onFocus={() => setFocusedField('body')}
                onChange={(e) => setEmailTemplate({ ...emailTemplate, body: e.target.value })}
              />
            </div>
          </div>

          {/* Step 4: Verification & Live Preview */}
          <div className="uni-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', backgroundColor: '#F1F5F9', borderRadius: '4px' }}>04</span>
                <h3 style={{ margin: 0 }}>Live Recipient Email Preview</h3>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--uni-muted)' }}>
                {data.length > 0 ? `Showing preview for record #1 (${data[0].email || 'No email'})` : 'Awaiting data upload'}
              </span>
            </div>

            <div className="emailer-preview-envelope">
              <div className="emailer-preview-header">
                <div><strong>From:</strong> {smtpConfig.from}</div>
                <div><strong>To:</strong> {data.length > 0 ? (data[0].email || 'student@jecrcu.edu.in') : 'recipient@example.com'}</div>
                <div><strong>Subject:</strong> {previewSubject}</div>
              </div>
              <div className="emailer-preview-body">
                {previewBody}
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <button
                type="button"
                onClick={downloadReport}
                disabled={sendResults.length === 0}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
              >
                <Download size={14} />
                <span>Export Dispatch Report (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={handleSendEmails}
                disabled={isSending || data.length === 0}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
                  fontSize: '0.88rem'
                }}
              >
                {isSending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                <span>{isSending ? `Dispatching (${progress.sent}/${progress.total})...` : `Dispatch ${data.length} Official Emails`}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dispatch Results Table */}
      {data.length > 0 && (
        <div className="uni-card" style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0 }}>Recipient Dispatch Status</h3>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`emailer-preset-btn ${activeTab === 'all' ? 'active' : ''}`}
                >
                  All ({data.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('success')}
                  className={`emailer-preset-btn ${activeTab === 'success' ? 'active' : ''}`}
                >
                  Success ({successCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('failed')}
                  className={`emailer-preset-btn ${activeTab === 'failed' ? 'active' : ''}`}
                >
                  Failed ({failureCount})
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6B6B6B' }} />
                <input
                  type="text"
                  placeholder="Search recipient..."
                  className="form-control"
                  style={{ paddingLeft: '32px', fontSize: '0.78rem', width: '220px' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="uni-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Recipient Name</th>
                  <th>Email Address</th>
                  <th>ID / Roll</th>
                  <th>Status</th>
                  <th>Diagnostics / Result</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.slice(0, 50).map((row, idx) => {
                  const emailKey = Object.keys(row).find((k) => k.toLowerCase().includes('email'));
                  const rowEmail = emailKey ? String(row[emailKey] || '') : '';
                  const nameKey = Object.keys(row).find((k) => k.toLowerCase().includes('name'));
                  const rowName = nameKey ? String(row[nameKey] || '') : (row.name || 'Student');
                  const idKey = Object.keys(row).find((k) => k.toLowerCase().includes('roll') || k.toLowerCase() === 'id');
                  const rowId = idKey ? String(row[idKey] || '') : (row.rollNumber || row.id || '—');
                  const res = sendResults.find((r) => r.email === rowEmail);

                  return (
                    <tr key={idx}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--uni-muted)' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{rowName}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{rowEmail || '—'}</td>
                      <td style={{ fontSize: '0.78rem' }}>{rowId}</td>
                      <td>
                        {res ? (
                          res.success ? (
                            <span className="badge badge-delivered" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle size={12} /> Dispatched
                            </span>
                          ) : (
                            <span className="badge badge-failed" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <XCircle size={12} /> Failed
                            </span>
                          )
                        ) : (
                          <span className="badge badge-draft" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> In Queue
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: res?.error ? '#DC2626' : 'var(--uni-muted)' }}>
                        {res?.error ? res.error : res?.success ? 'Delivered via SMTP' : 'Ready for batch'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredData.length > 50 && (
              <div style={{ textAlign: 'center', padding: '12px', fontSize: '0.75rem', color: 'var(--uni-muted)' }}>
                Showing first 50 of {filteredData.length} records. Download the Excel report to inspect all rows.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gmail App Password Setup Guide Modal */}
      {showGuideModal && (
        <div className="emailer-modal-overlay">
          <div className="emailer-modal-content">
            <div className="emailer-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} color="var(--uni-red)" />
                <h3 style={{ margin: 0 }}>University SMTP & Google App Password Guide</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6B6B' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="emailer-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '12px', backgroundColor: '#EFF6FF', borderRadius: '4px', border: '1px solid #BFDBFE', fontSize: '0.8rem', color: '#1E40AF' }}>
                <strong>Important:</strong> Modern Gmail and Google Workspace require a 16-character <strong>App Password</strong> instead of your regular university login password.
              </div>

              <div>
                <h4 style={{ fontSize: '0.88rem', margin: '0 0 6px' }}>Step 1: Enable 2-Step Verification</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#4B5563' }}>
                  Go to your Google Account (myaccount.google.com) &rarr; <strong>Security</strong> &rarr; Enable <strong>2-Step Verification</strong>.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: '0.88rem', margin: '0 0 6px' }}>Step 2: Generate App Password</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#4B5563' }}>
                  In Security search bar, search for <strong>App Passwords</strong>. Enter a name (e.g., "JECRC Emailer") and click <strong>Create</strong>. Copy the 16-character code generated.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: '0.88rem', margin: '0 0 6px' }}>Step 3: Recommended Configuration</h4>
                <ul style={{ margin: '4px 0 0 16px', fontSize: '0.8rem', color: '#4B5563', lineHeight: 1.6 }}>
                  <li><strong>Host:</strong> smtp.gmail.com</li>
                  <li><strong>Port:</strong> 465 (SSL Encrypted)</li>
                  <li><strong>Username:</strong> Your full email address</li>
                  <li><strong>Password:</strong> The 16-character App Password (without spaces)</li>
                </ul>
              </div>
            </div>
            <div className="emailer-modal-footer">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '8px 18px' }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
