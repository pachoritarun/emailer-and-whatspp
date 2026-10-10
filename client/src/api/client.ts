import { Campaign, DiagnosticData, SystemHealth, DLQItem, ContactItem, ImportLog, AuditLog } from '../types/index.js';

const rawBase = import.meta.env.BASE_URL || '/';
export const API_BASE = (rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase) + '/api';

export const api = {
  // Campaigns
  async getCampaigns(): Promise<{ success: boolean; campaigns: Campaign[] }> {
    const res = await fetch(`${API_BASE}/campaigns`);
    return res.json();
  },

  async getCampaign(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/campaigns/${id}`);
    return res.json();
  },

  async launchCampaign(data: {
    name: string;
    template_id: string;
    audience: any;
    schedule_type: 'IMMEDIATE' | 'SCHEDULED';
    scheduled_at?: string;
    variables?: Record<string, string>;
  }): Promise<{ success: boolean; campaign_id: string; code: string }> {
    const res = await fetch(`${API_BASE}/campaigns/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Diagnostics
  async getCampaignDiagnostics(campaignId: string): Promise<{ success: boolean } & DiagnosticData> {
    const res = await fetch(`${API_BASE}/diagnostics/campaign/${campaignId}`);
    return res.json();
  },

  async triggerReconciliation(campaignId: string): Promise<{ success: boolean; report: any }> {
    const res = await fetch(`${API_BASE}/diagnostics/campaign/${campaignId}/reconcile`, {
      method: 'POST'
    });
    return res.json();
  },

  // Observability & System Health
  async getSystemHealth(): Promise<SystemHealth> {
    const res = await fetch(`${API_BASE}/observability/health`);
    return res.json();
  },

  async getMetaStatus(): Promise<any> {
    const res = await fetch(`${API_BASE}/observability/meta-status`);
    return res.json();
  },

  async getDLQ(): Promise<{ success: boolean; total_dead_letter: number; items: DLQItem[] }> {
    const res = await fetch(`${API_BASE}/observability/dlq`);
    return res.json();
  },

  async retryDLQ(jobId: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/observability/dlq/${jobId}/retry`, { method: 'POST' });
    return res.json();
  },

  async ignoreDLQ(jobId: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/observability/dlq/${jobId}/ignore`, { method: 'POST' });
    return res.json();
  },

  // Correlation & Event Tracer
  async traceCorrelation(query: string): Promise<any> {
    const res = await fetch(`${API_BASE}/events/trace?q=${encodeURIComponent(query)}`);
    return res.json();
  },

  // Contacts & Import
  async getContacts(): Promise<{ success: boolean; total: number; breakdown: any; contacts: ContactItem[] }> {
    const res = await fetch(`${API_BASE}/contacts`);
    return res.json();
  },

  async deleteContact(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/contacts/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  async clearAllContacts(): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/contacts/clear`, {
      method: 'POST'
    });
    return res.json();
  },

  async getDepartments(): Promise<{ success: boolean; departments: Array<{ id: string; code: string; name: string; contact_count: number }> }> {
    const res = await fetch(`${API_BASE}/contacts/departments`);
    return res.json();
  },

  async getImportLogs(): Promise<{ success: boolean; import_logs: ImportLog[] }> {
    const res = await fetch(`${API_BASE}/contacts/import-logs`);
    return res.json();
  },

  async uploadContactsExcel(data: {
    file_base64: string;
    filename: string;
    default_category?: string;
    default_department?: string;
    clear_existing?: boolean;
  }): Promise<{
    success: boolean;
    import_code: string;
    filename: string;
    rows_detected: number;
    rows_imported: number;
    rows_rejected: number;
    invalid_phone_records: number;
    duration_ms: number;
    error?: string;
  }> {
    const res = await fetch(`${API_BASE}/contacts/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async simulateImport(filename: string, rows: number): Promise<any> {
    const res = await fetch(`${API_BASE}/contacts/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, rows })
    });
    return res.json();
  },

  async recategorizeContacts(fromCategory?: string, toCategory: string = 'STUDENT'): Promise<{
    success: boolean;
    affected_rows: number;
    message: string;
    error?: string;
  }> {
    const res = await fetch(`${API_BASE}/contacts/recategorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_category: fromCategory, to_category: toCategory })
    });
    return res.json();
  },

  // Audit Logs
  async getAuditLogs(): Promise<{ success: boolean; total: number; logs: AuditLog[] }> {
    const res = await fetch(`${API_BASE}/audit-logs`);
    return res.json();
  },

  // Templates
  async getTemplates(): Promise<{ success: boolean; templates: any[] }> {
    const res = await fetch(`${API_BASE}/templates`);
    return res.json();
  },

  async saveTemplate(data: {
    name: string;
    category: string;
    language: string;
    header_type?: string;
    body: string;
    sample_variables?: string[];
  }): Promise<{ success: boolean; message: string; template: any }> {
    const res = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Authentication & Role Management
  async login(username: string, password: string): Promise<{
    success: boolean;
    error?: string;
    token?: string;
    user?: {
      id: string;
      username: string;
      role: 'DEVELOPER' | 'SENDER';
      fullName: string;
      mustChangeCredentials: boolean;
    };
  }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return res.json();
  },

  async changeCredentials(newUsername: string, newPassword?: string, userId?: string): Promise<{
    success: boolean;
    error?: string;
    user?: any;
  }> {
    const token = localStorage.getItem('jecrc_auth_token');
    const res = await fetch(`${API_BASE}/auth/change-credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ newUsername, newPassword, userId })
    });
    return res.json();
  },

  async getSenderActivity(limit = 100): Promise<{
    success: boolean;
    total: number;
    activities: any[];
  }> {
    const token = localStorage.getItem('jecrc_auth_token');
    const res = await fetch(`${API_BASE}/auth/sender-activity?limit=${limit}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    return res.json();
  },

  // WhatsApp In-Portal Template Studio
  async createAndSubmitTemplate(data: {
    name: string;
    category: 'UTILITY' | 'MARKETING';
    language: string;
    header_type?: string;
    header_text?: string;
    header_sample?: string;
    body_text: string;
    sample_variables?: string[];
    footer_text?: string;
    buttons?: Array<{
      type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
      text: string;
      url?: string;
      url_example?: string;
      phone_number?: string;
    }>;
  }): Promise<{ success: boolean; message?: string; template?: any; error?: string }> {
    const token = localStorage.getItem('jecrc_auth_token');
    const res = await fetch(`${API_BASE}/templates/create-and-submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async syncMetaTemplates(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    const token = localStorage.getItem('jecrc_auth_token');
    const res = await fetch(`${API_BASE}/templates/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    return res.json();
  },

  async deleteTemplate(name: string): Promise<{ success: boolean; error?: string }> {
    const token = localStorage.getItem('jecrc_auth_token');
    const res = await fetch(`${API_BASE}/templates/${name}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    return res.json();
  },

  // User Profile Management (Developer Mode)
  async getUsers(): Promise<{ success: boolean; users: any[]; error?: string }> {
    const token = localStorage.getItem('jecrc_auth_token');
    const res = await fetch(`${API_BASE}/auth/users`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    return res.json();
  },

  async createUser(data: {
    username: string;
    password: string;
    fullName: string;
    email?: string;
    role?: 'DEVELOPER' | 'SENDER';
    mustChangeCredentials?: boolean;
  }): Promise<{ success: boolean; user?: any; error?: string }> {
    const token = localStorage.getItem('jecrc_auth_token');
    const res = await fetch(`${API_BASE}/auth/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    const token = localStorage.getItem('jecrc_auth_token');
    const res = await fetch(`${API_BASE}/auth/users/${userId}`, {
      method: 'DELETE',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    return res.json();
  },

  async toggleUserStatus(userId: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
    const token = localStorage.getItem('jecrc_auth_token');
    const res = await fetch(`${API_BASE}/auth/users/${userId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ isActive })
    });
    return res.json();
  }
};

