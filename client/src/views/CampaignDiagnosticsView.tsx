import React, { useEffect, useState } from 'react';
import { api, API_BASE } from '../api/client.js';
import { DiagnosticData, Campaign } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw,
  Clock,
  Radio,
  FileCheck2,
  ShieldAlert
} from 'lucide-react';

interface CampaignDiagnosticsViewProps {
  initialCampaignId?: string;
}

export const CampaignDiagnosticsView: React.FC<CampaignDiagnosticsViewProps> = ({ initialCampaignId }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string>(initialCampaignId || '');
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    api.getCampaigns().then(res => {
      if (res.success && res.campaigns.length > 0) {
        setCampaigns(res.campaigns);
        if (!selectedId) setSelectedId(res.campaigns[0].id);
      }
    });
  }, []);

  const loadDiagnostics = (id: string) => {
    if (!id) return;
    setLoading(true);
    api.getCampaignDiagnostics(id).then(res => {
      if (res.success) setData(res);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (selectedId) loadDiagnostics(selectedId);
  }, [selectedId]);

  const handleReconcile = async () => {
    if (!selectedId) return;
    setReconciling(true);
    try {
      const res = await api.triggerReconciliation(selectedId);
      if (res.success) {
        alert('Forensic reconciliation audit completed successfully.');
        loadDiagnostics(selectedId);
      }
    } finally {
      setReconciling(false);
    }
  };

  const handleExport = () => {
    if (!selectedId) return;
    window.open(`${API_BASE}/diagnostics/campaign/${selectedId}/export`, '_blank');
  };

  if (!loading && campaigns.length === 0) {
    return (
      <div className="uni-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <Activity size={36} color="var(--uni-muted)" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px', color: 'var(--uni-black)' }}>
          Zero Dispatched Notices Recorded
        </h3>
        <p style={{ color: 'var(--uni-muted)', fontSize: '0.84rem', maxWidth: '480px', margin: '0 auto 16px' }}>
          Once an official notice is sent through the WhatsApp Cloud API, its counters, state machine lifecycle, stuck message diagnostics, and forensic reconciliation audit will be visible here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Campaign Selector Bar */}
      <div className="uni-card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>
              Select Campaign for Diagnostic Audit:
            </label>
            <select
              className="form-select"
              style={{ width: '380px' }}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleReconcile}
              disabled={reconciling}
              className="btn btn-secondary btn-sm"
            >
              <RefreshCw size={14} className={reconciling ? 'animate-spin' : ''} />
              <span>{reconciling ? 'Reconciling...' : 'Run Forensic Reconciliation'}</span>
            </button>

            <button onClick={handleExport} className="btn btn-secondary btn-sm">
              <Download size={14} />
              <span>Export Audit Report</span>
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--uni-muted)' }}>
          Loading forensic diagnostic metrics...
        </div>
      )}

      {data && !loading && (
        <>
          {/* Section 6: Campaign Counters Waterfall */}
          <div className="uni-card" style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Canonical Campaign Counters (Derived from Recipient State Machine)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
              <div style={{ padding: '12px', border: '1px solid var(--uni-border-gray)', borderRadius: 'var(--radius-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--uni-muted)' }}>TARGETED</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{data.counters.targeted?.toLocaleString()}</div>
              </div>
              <div style={{ padding: '12px', border: '1px solid var(--uni-border-gray)', borderRadius: 'var(--radius-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--uni-muted)' }}>ELIGIBLE</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{data.counters.eligible?.toLocaleString()}</div>
              </div>
              <div style={{ padding: '12px', border: '1px solid var(--uni-border-gray)', borderRadius: 'var(--radius-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--uni-muted)' }}>SUBMITTED</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{data.counters.submitted?.toLocaleString()}</div>
              </div>
              <div style={{ padding: '12px', border: '1px solid var(--uni-border-gray)', borderRadius: 'var(--radius-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--uni-muted)' }}>DELIVERED</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1B5E20' }}>{data.counters.delivered?.toLocaleString()}</div>
              </div>
              <div style={{ padding: '12px', border: '1px solid var(--uni-border-gray)', borderRadius: 'var(--radius-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--uni-muted)' }}>READ</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1B5E20' }}>{data.counters.read?.toLocaleString()}</div>
              </div>
              <div style={{ padding: '12px', border: '1px solid var(--uni-border-gray)', borderRadius: 'var(--radius-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--uni-muted)' }}>FAILED</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: data.counters.failed > 0 ? 'var(--uni-red)' : 'inherit' }}>
                  {data.counters.failed?.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Section 8: Stuck Message Alert Banner (if any) */}
          {data.stuck_messages.length > 0 && (
            <div style={{
              padding: '14px 18px',
              backgroundColor: '#FFEBEE',
              border: '1px solid #FFCDD2',
              borderRadius: 'var(--radius-subtle)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <AlertTriangle size={20} color="#B00020" />
              <div>
                <strong style={{ color: '#B00020' }}>Stuck Message Warning: </strong>
                {data.stuck_messages.length} messages exceeded standard queue timeout thresholds (e.g. PROCESSING &gt; 10m).
                Automatic recovery will reclaim locks.
              </div>
            </div>
          )}

          {/* Diagnostic Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* Failure Taxonomy Breakdown (Section 13) */}
            <div className="uni-card">
              <h3 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>
                Failure Taxonomy Breakdown (Meta Provider Rejections)
              </h3>
              {Object.keys(data.failure_breakdown).length === 0 ? (
                <div className="text-muted" style={{ fontSize: '0.8125rem' }}>
                  Zero provider rejections recorded.
                </div>
              ) : (
                <div className="table-container">
                  <table className="uni-table">
                    <thead>
                      <tr>
                        <th>Error Classification Code</th>
                        <th style={{ textAlign: 'right' }}>Occurrences</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.failure_breakdown).map(([code, count]) => (
                        <tr key={code}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--uni-red)', fontWeight: 600 }}>
                            {code}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Reconciliation Report Summary (Section 7) */}
            <div className="uni-card">
              <h3 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>
                Forensic Reconciliation Audit Results
              </h3>
              {data.latest_reconciliation ? (
                <div style={{ fontSize: '0.84rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Audit Run Timestamp:</span>
                    <strong>{new Date(data.latest_reconciliation.created_at).toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Missing Provider Confirmations:</span>
                    <strong style={{ color: data.latest_reconciliation.missing_provider_confirmations > 0 ? 'var(--uni-red)' : 'inherit' }}>
                      {data.latest_reconciliation.missing_provider_confirmations}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Duplicate Webhook Deliveries:</span>
                    <strong>{data.latest_reconciliation.duplicate_webhooks_detected}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Counter Discrepancies:</span>
                    <strong>{data.latest_reconciliation.counter_discrepancies}</strong>
                  </div>

                  <div style={{ marginTop: '8px', borderTop: '1px solid var(--uni-border-gray)', paddingTop: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--uni-muted)', marginBottom: '4px' }}>
                      Audit Findings & Recommendations:
                    </div>
                    <ul style={{ paddingLeft: '20px', color: '#444' }}>
                      {data.latest_reconciliation.details?.discrepancies?.map((d: string, i: number) => (
                        <li key={i}>{d}</li>
                      ))}
                      {data.latest_reconciliation.details?.recommendations?.map((r: string, i: number) => (
                        <li key={i} style={{ color: '#1B5E20', fontWeight: 500 }}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-muted" style={{ fontSize: '0.8125rem' }}>
                  No previous reconciliation report on record. Click "Run Forensic Reconciliation" to execute an audit.
                </div>
              )}
            </div>
          </div>

          {/* Section 19: Immutable Event Stream Timeline */}
          <div className="uni-card">
            <h3 style={{ fontSize: '0.95rem', marginBottom: '14px' }}>
              Forensic Event Waterfall Timeline (Last 50 Immutable Transitions)
            </h3>
            <div className="table-container">
              <table className="uni-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Lifecycle Event</th>
                    <th>Recipient UUID</th>
                    <th>Correlation ID</th>
                    <th>State Transition / Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.timeline.map((evt, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--uni-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </td>
                      <td>
                        <StatusBadge status={evt.event} />
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                        {evt.recipient_id}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--uni-muted)' }}>
                        {evt.correlation_id}
                      </td>
                      <td style={{ fontSize: '0.8125rem' }}>
                        {evt.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
