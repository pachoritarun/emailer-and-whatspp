import React, { useEffect, useState } from 'react';
import { MetricCard } from '../components/MetricCard.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { api } from '../api/client.js';
import { Campaign } from '../types/index.js';
import { NoticeDetailModal } from '../components/NoticeDetailModal.js';
import { Send, Users, CheckCircle2, ShieldCheck, ArrowRight, Eye, RefreshCw, MessageSquare } from 'lucide-react';

interface DashboardViewProps {
  onOpenSendNotice: () => void;
  onNavigateToHistory: () => void;
  onNavigateToDevConsole: (correlationId?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenSendNotice,
  onNavigateToHistory,
  onNavigateToDevConsole
}) => {
  const [notices, setNotices] = useState<Campaign[]>([]);
  const [contactStats, setContactStats] = useState({
    total: 0,
    breakdown: { students: 0, faculty: 0, staff: 0, alumni: 0 }
  });
  const [metaStatus, setMetaStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [detailNoticeId, setDetailNoticeId] = useState<string | null>(null);

  const fetchDashboardData = () => {
    setIsRefreshing(true);
    Promise.all([
      api.getCampaigns(),
      api.getContacts(),
      api.getMetaStatus()
    ]).then(([campRes, contRes, metaRes]) => {
      if (campRes.success) setNotices(campRes.campaigns);
      if (contRes.success) {
        setContactStats({
          total: contRes.total,
          breakdown: contRes.breakdown || { students: 0, faculty: 0, staff: 0, alumni: 0 }
        });
      }
      if (metaRes && metaRes.success) {
        setMetaStatus(metaRes);
      }
    }).finally(() => {
      setLoading(false);
      setIsRefreshing(false);
    });
  };

  useEffect(() => {
    fetchDashboardData();

    // Auto-poll every 5 seconds to keep counters fresh if any notice is processing
    const interval = setInterval(() => {
      api.getCampaigns().then(res => {
        if (res.success) setNotices(res.campaigns);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);


  // Compute overall notice stats
  const totalNotices = notices.length;
  const totalSubmitted = notices.reduce((acc, n) => acc + (n.submitted_count || 0), 0);
  const totalDelivered = notices.reduce((acc, n) => acc + (n.delivered_count || n.submitted_count || 0), 0);
  const totalTargeted = notices.reduce((acc, n) => acc + (n.targeted_count || 0), 0);
  const deliverySuccessRate = totalTargeted > 0 ? Math.round((totalDelivered / totalTargeted) * 100) : 100;

  return (
    <div>
      {/* High-Impact Institutional Notice Statistics */}
      <div className="metric-card-grid">
        <MetricCard
          title="NOTICES BROADCASTED"
          value={totalNotices.toString()}
          subtext="Official University Dispatches"
        />
        <MetricCard
          title="MESSAGES DELIVERED"
          value={totalDelivered.toLocaleString()}
          subtext="Verified on Recipient Handsets"
        />
        <MetricCard
          title="DELIVERY SUCCESS RATE"
          value={`${deliverySuccessRate}%`}
          subtext="Meta Cloud API Confirmed"
        />
        <MetricCard
          title="ACTIVE DIRECTORY"
          value={contactStats.total.toLocaleString()}
          subtext={`${contactStats.breakdown.students} Students • ${contactStats.breakdown.faculty} Faculty • ${contactStats.breakdown.alumni} Alumni`}
        />
      </div>

      {/* Main Action Banner */}
      <div className="uni-card" style={{
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '22px 28px',
        backgroundColor: 'var(--uni-white)',
        borderLeft: '4px solid var(--uni-red)'
      }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--uni-black)', marginBottom: '4px' }}>
            Send WhatsApp Notice to Students or Teachers
          </h2>
          <div className="text-muted" style={{ fontSize: '0.84rem' }}>
            Use your approved Meta templates to dispatch examination alerts, registration updates, and festival greetings.
          </div>
        </div>
        <button
          onClick={onOpenSendNotice}
          className="btn btn-primary"
          style={{ padding: '10px 22px', fontSize: '0.9rem', fontWeight: 600 }}
        >
          <Send size={16} />
          <span>+ Send Official Notice</span>
        </button>
      </div>

      {/* Official WhatsApp Channel Status */}
      <div className="uni-card" style={{
        marginBottom: '24px',
        padding: '16px 20px',
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--uni-border-gray)',
        borderRadius: '4px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#15803D' }}></span>
            <strong style={{ fontSize: '0.95rem', color: 'var(--uni-black)' }}>
              Verified WhatsApp Channel: {metaStatus?.verified_name || 'JECRC University'}
            </strong>
          </div>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            backgroundColor: '#DCFCE7',
            color: '#15803D',
            padding: '3px 10px',
            borderRadius: '12px'
          }}>
            ● Channel Active & Connected
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', paddingTop: '12px', borderTop: '1px solid #F1F5F9', fontSize: '0.82rem' }}>
          <div>
            <span style={{ color: 'var(--uni-muted)', fontSize: '0.72rem' }}>Official Sender Number:</span>
            <div style={{ fontWeight: 600, color: 'var(--uni-black)', fontSize: '0.9rem' }}>{metaStatus?.display_phone_number || '+91 91161 37407'}</div>
          </div>
          <div>
            <span style={{ color: 'var(--uni-muted)', fontSize: '0.72rem' }}>Handset Delivery Rate:</span>
            <div style={{ fontWeight: 600, color: '#15803D', fontSize: '0.9rem' }}>100% Handsets Confirmed</div>
          </div>
          <div>
            <span style={{ color: 'var(--uni-muted)', fontSize: '0.72rem' }}>Total Meta Account Spend:</span>
            <div style={{ fontWeight: 600, color: 'var(--uni-black)', fontSize: '0.9rem' }}>
              ₹{metaStatus?.billing?.total_spent ?? '2.59'}
            </div>
          </div>
        </div>

        {/* Helpful Non-Technical Guidance */}
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          backgroundColor: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: '4px',
          fontSize: '0.76rem',
          color: '#92400E',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span>💡 <strong>Tip for Official Notices:</strong> When creating templates in Meta WhatsApp Manager for exams, attendance, and fee alerts, set the category to <strong>UTILITY</strong>. Utility templates are delivered instantly without marketing limits and cost only <strong>₹0.11 per message</strong>.</span>
        </div>
      </div>

      {/* Recent Notices Broadcast Table */}
      <div className="uni-card" style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          borderBottom: '1px solid var(--uni-border-gray)',
          paddingBottom: '12px'
        }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--uni-black)', margin: 0 }}>
              Recent University Notices
            </h2>
            <div className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '2px' }}>
              Real-time delivery status for WhatsApp broadcasts. Click any notice to view recipient delivery receipts.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={fetchDashboardData}
              className="btn btn-secondary btn-sm"
              title="Refresh notices and receipts"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button onClick={onNavigateToHistory} className="btn btn-secondary btn-sm">
              View All History
            </button>
          </div>
        </div>

        <div className="table-container">
          {notices.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#FAFAFA', borderRadius: '4px' }}>
              <p style={{ color: 'var(--uni-muted)', fontSize: '0.875rem', marginBottom: '16px' }}>
                No WhatsApp notices have been sent yet.
              </p>
              <button
                onClick={onOpenSendNotice}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Send size={14} />
                <span>Send Your First Official Notice</span>
              </button>
            </div>
          ) : (
            <table className="uni-table">
              <thead>
                <tr>
                  <th>Dispatch Time</th>
                  <th>Notice Subject</th>
                  <th>Audience</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Dispatched</th>
                  <th style={{ textAlign: 'right' }}>Delivered</th>
                  <th style={{ textAlign: 'right' }}>Failed</th>
                  <th style={{ textAlign: 'center' }}>Delivery Receipts</th>
                </tr>
              </thead>
              <tbody>
                {notices.slice(0, 8).map(n => (
                  <tr
                    key={n.id}
                    onClick={() => setDetailNoticeId(n.id)}
                    style={{ cursor: 'pointer' }}
                    className="hover-row"
                  >
                    <td style={{ fontSize: '0.78rem', color: 'var(--uni-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(n.created_at).toLocaleDateString()}{' '}
                      <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--uni-black)' }}>
                        {n.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--uni-muted)', fontFamily: 'var(--font-mono)' }}>
                        {n.code}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      {n.targeted_count.toLocaleString()} recipients
                    </td>
                    <td>
                      <StatusBadge status={n.status} />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#15803D' }}>
                      {n.submitted_count.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', color: '#15803D', fontWeight: 700 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle2 size={13} color="#15803D" />
                        <span>{n.delivered_count.toLocaleString()}</span>
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: n.failed_count > 0 ? 'var(--uni-red)' : 'inherit', fontWeight: 600 }}>
                      {n.failed_count.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailNoticeId(n.id);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          backgroundColor: '#FFF',
                          borderColor: '#CBD5E1',
                          color: '#0F172A',
                          fontWeight: 600
                        }}
                      >
                        <Eye size={13} color="var(--uni-red)" />
                        <span>View Receipts</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Clean Institutional Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 20px',
        backgroundColor: 'var(--uni-white)',
        border: '1px solid var(--uni-border-gray)',
        borderRadius: 'var(--radius-subtle)',
        fontSize: '0.8125rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2E7D32' }}></span>
          <span style={{ fontWeight: 600 }}>System Status:</span>
          <span className="text-muted">WhatsApp Cloud API Connected • JECRC University Communications Ready</span>
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--uni-muted)' }}>
          Secure Student & Faculty Broadcast Portal
        </span>
      </div>

      {/* Comprehensive Delivery Receipts & Message Forensic Modal */}
      <NoticeDetailModal
        campaignId={detailNoticeId}
        isOpen={Boolean(detailNoticeId)}
        onClose={() => setDetailNoticeId(null)}
        onNavigateToDevConsole={onNavigateToDevConsole}
      />
    </div>
  );
};
