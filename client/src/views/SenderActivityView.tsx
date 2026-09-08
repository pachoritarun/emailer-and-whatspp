import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, ShieldAlert, Send, Mail, UserCheck, KeyRound, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../api/client.js';

export const SenderActivityView: React.FC = () => {
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      const res = await api.getSenderActivity(150);
      if (res.success && Array.isArray(res.activities)) {
        setActivities(res.activities);
      }
    } catch (err) {
      console.error('Failed to fetch sender activities:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, []);

  const filteredActivities = activities.filter((act) => {
    const matchesAction = actionFilter === 'ALL' || act.action === actionFilter;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      act.action?.toLowerCase().includes(searchLower) ||
      act.ip_address?.toLowerCase().includes(searchLower) ||
      JSON.stringify(act.metadata || {}).toLowerCase().includes(searchLower);
    return matchesAction && matchesSearch;
  });

  const whatsappCount = activities.filter(a => a.action === 'WHATSAPP_CAMPAIGN_LAUNCHED' || a.action === 'LAUNCH_CAMPAIGN').length;
  const emailCount = activities.filter(a => a.action === 'EMAIL_BATCH_DISPATCHED').length;
  const loginCount = activities.filter(a => a.action === 'USER_LOGIN').length;
  const credsCount = activities.filter(a => a.action === 'CREDENTIALS_CHANGED').length;

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'WHATSAPP_CAMPAIGN_LAUNCHED':
      case 'LAUNCH_CAMPAIGN':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#ECFDF5', color: '#065F46', fontSize: '0.74rem', fontWeight: 700 }}>
            <Send size={12} /> WhatsApp Notice
          </span>
        );
      case 'EMAIL_BATCH_DISPATCHED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#EFF6FF', color: '#1E40AF', fontSize: '0.74rem', fontWeight: 700 }}>
            <Mail size={12} /> Email Broadcast
          </span>
        );
      case 'USER_LOGIN':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#F3F4F6', color: '#374151', fontSize: '0.74rem', fontWeight: 600 }}>
            <UserCheck size={12} /> User Login
          </span>
        );
      case 'CREDENTIALS_CHANGED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#FFFBEB', color: '#92400E', fontSize: '0.74rem', fontWeight: 700 }}>
            <KeyRound size={12} /> Security Change
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#F8FAFC', color: '#475569', fontSize: '0.74rem', fontWeight: 600 }}>
            {action}
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Metrics Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
            WhatsApp Dispatches
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#065F46', marginTop: '4px' }}>
            {whatsappCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>Notices sent to students/staff</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
            Email Broadcasts
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E40AF', marginTop: '4px' }}>
            {emailCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>SMTP batches executed</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
            Sender Logins
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#334155', marginTop: '4px' }}>
            {loginCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>Authenticated portal sessions</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
            Credential Updates
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#92400E', marginTop: '4px' }}>
            {credsCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>Username / password resets</div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div style={{
        backgroundColor: '#FFFFFF',
        padding: '16px 20px',
        borderRadius: '8px',
        border: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          {/* Search Box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            width: '320px'
          }}>
            <Search size={15} color="#64748B" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by notice, IP, or metadata..."
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.84rem',
                color: '#0F172A',
                width: '100%'
              }}
            />
          </div>

          {/* Action Filter Pills */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {['ALL', 'WHATSAPP_CAMPAIGN_LAUNCHED', 'EMAIL_BATCH_DISPATCHED', 'USER_LOGIN', 'CREDENTIALS_CHANGED'].map((act) => {
              const label = act === 'ALL' ? 'All Activities'
                : act === 'WHATSAPP_CAMPAIGN_LAUNCHED' ? 'WhatsApp'
                : act === 'EMAIL_BATCH_DISPATCHED' ? 'Email'
                : act === 'USER_LOGIN' ? 'Logins'
                : 'Security';
              const isSelected = actionFilter === act;
              return (
                <button
                  key={act}
                  onClick={() => setActionFilter(act)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid ' + (isSelected ? '#B80000' : '#E2E8F0'),
                    backgroundColor: isSelected ? '#B80000' : '#FFFFFF',
                    color: isSelected ? '#FFFFFF' : '#475569',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={fetchActivities}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            backgroundColor: '#F1F5F9',
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            color: '#334155',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Activity Table */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '8px',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <th style={{ padding: '12px 18px', fontWeight: 600 }}>Timestamp</th>
              <th style={{ padding: '12px 18px', fontWeight: 600 }}>Actor / Role</th>
              <th style={{ padding: '12px 18px', fontWeight: 600 }}>Activity Type</th>
              <th style={{ padding: '12px 18px', fontWeight: 600 }}>Action Details & Payload</th>
              <th style={{ padding: '12px 18px', fontWeight: 600 }}>IP Address</th>
              <th style={{ padding: '12px 18px', fontWeight: 600, textAlign: 'center' }}>Result</th>
            </tr>
          </thead>
          <tbody>
            {filteredActivities.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                  {isLoading ? 'Loading activity logs...' : 'No activity records match your current filters.'}
                </td>
              </tr>
            ) : (
              filteredActivities.map((act) => {
                const meta = act.metadata || {};
                return (
                  <tr key={act.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.1s ease' }}>
                    <td style={{ padding: '12px 18px', color: '#64748B', whiteSpace: 'nowrap' }}>
                      {new Date(act.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}{' '}
                      <span style={{ fontWeight: 600, color: '#0F172A' }}>
                        {new Date(act.created_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{meta.username || act.user_role || 'Sender'}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Role: {act.user_role}</div>
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      {getActionBadge(act.action)}
                    </td>
                    <td style={{ padding: '12px 18px', color: '#334155' }}>
                      {act.action === 'WHATSAPP_CAMPAIGN_LAUNCHED' && (
                        <div>
                          <div style={{ fontWeight: 600, color: '#0F172A' }}>Notice: {meta.campaign_name || act.entity_id}</div>
                          <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                            Recipients: <b>{meta.targeted || meta.eligible || 0}</b> • Template: <code>{meta.template}</code>
                          </div>
                        </div>
                      )}
                      {act.action === 'EMAIL_BATCH_DISPATCHED' && (
                        <div>
                          <div style={{ fontWeight: 600, color: '#0F172A' }}>Subject: "{meta.subject || 'Institutional Notice'}"</div>
                          <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                            Dispatched: <b>{meta.successful || 0}</b> / {meta.total_recipients || 0} recipients • Sender: {meta.smtp_sender}
                          </div>
                        </div>
                      )}
                      {act.action === 'USER_LOGIN' && (
                        <div>
                          <span style={{ fontWeight: 600 }}>Signed into Portal Session</span>
                          {meta.must_change_credentials && (
                            <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: '#D97706', fontWeight: 600 }}>
                              [Initial Login - Credential Setup Pending]
                            </span>
                          )}
                        </div>
                      )}
                      {act.action === 'CREDENTIALS_CHANGED' && (
                        <div>
                          <span style={{ fontWeight: 600 }}>Updated login username to: </span>
                          <span style={{ backgroundColor: '#FEF3C7', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>
                            {meta.new_username}
                          </span>
                          {meta.password_updated && <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: '#059669' }}>✓ Password encrypted</span>}
                        </div>
                      )}
                      {!['WHATSAPP_CAMPAIGN_LAUNCHED', 'EMAIL_BATCH_DISPATCHED', 'USER_LOGIN', 'CREDENTIALS_CHANGED'].includes(act.action) && (
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#475569' }}>
                          {JSON.stringify(meta)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 18px', color: '#64748B', fontFamily: 'monospace', fontSize: '0.76rem' }}>
                      {act.ip_address || '127.0.0.1'}
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                      {act.success ? (
                        <span style={{ color: '#15803D', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                          <CheckCircle2 size={16} /> Success
                        </span>
                      ) : (
                        <span style={{ color: '#DC2626', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                          <XCircle size={16} /> Failed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
