import React, { useState } from 'react';
import { api } from '../api/client.js';
import { Search, GitCommit, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge.js';

export const CorrelationTracerView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [traceData, setTraceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.traceCorrelation(query.trim());
      setTraceData(res);
    } catch (err) {
      alert('Error fetching correlation trace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Search Header */}
      <div className="uni-card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
          Forensic Correlation ID & Message Lifecycle Tracer
        </h2>
        <div className="text-muted" style={{ fontSize: '0.8125rem', marginBottom: '16px' }}>
          Trace a message across all operational layers: Portal → REST API → MySQL Queue → Native Worker → Meta Graph API → Webhook Ingestion → Terminal Reconciled State.
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            className="form-input"
            style={{ flex: 1 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter Correlation ID (e.g. CORR-xxx), Recipient UUID, or Provider Message ID (wamid.xxx)..."
          />
          <button type="submit" className="btn btn-primary">
            <Search size={16} />
            <span>Trace Lifecycle</span>
          </button>
        </form>

        <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--uni-muted)' }}>
          Search by any Notice Correlation ID (e.g. from Notice History), Recipient UUID, or Meta Provider Message ID (wamid.xxx)
        </div>
      </div>

      {loading && (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--uni-muted)' }}>
          Tracing forensic correlation telemetry...
        </div>
      )}

      {traceData && traceData.success && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
          {/* Recipient State Card */}
          <div className="uni-card" style={{ height: 'fit-content' }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '14px', borderBottom: '1px solid var(--uni-border-gray)', paddingBottom: '8px' }}>
              Message Identity Record
            </h3>
            {traceData.recipient ? (
              <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div className="text-muted">Current Verified Status:</div>
                  <div style={{ marginTop: '4px' }}>
                    <StatusBadge status={traceData.recipient.status} />
                  </div>
                </div>
                <div>
                  <div className="text-muted">Internal Recipient UUID:</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {traceData.recipient.id}
                  </div>
                </div>
                <div>
                  <div className="text-muted">Correlation ID:</div>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--uni-red)', fontWeight: 600 }}>
                    {traceData.recipient.correlation_id}
                  </div>
                </div>
                <div>
                  <div className="text-muted">Meta Provider Message ID:</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                    {traceData.recipient.provider_message_id || 'Pending Provider Acknowledgement'}
                  </div>
                </div>
                <div>
                  <div className="text-muted">Retry Count:</div>
                  <div>{traceData.recipient.retry_count} attempts</div>
                </div>
              </div>
            ) : (
              <div className="text-muted" style={{ fontSize: '0.8125rem' }}>
                No active recipient record matched for this identifier.
              </div>
            )}
          </div>

          {/* 7-Layer Waterfall Flow */}
          <div className="uni-card">
            <h3 style={{ fontSize: '0.95rem', marginBottom: '16px' }}>
              End-to-End System Waterfall Trace (7 Operational Layers)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {traceData.trace_steps?.map((st: any) => (
                <div
                  key={st.step}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    padding: '12px 16px',
                    border: '1px solid var(--uni-border-gray)',
                    borderRadius: 'var(--radius-subtle)',
                    backgroundColor: st.status === 'FAILED' ? '#FFEBEE' : 'var(--uni-white)'
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: st.status === 'FAILED' ? 'var(--uni-red)' : 'var(--uni-black)',
                    color: 'var(--uni-white)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>
                    {st.step}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{st.title}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--uni-muted)' }}>
                        {new Date(st.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--uni-red)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Layer: {st.layer}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#444' }}>
                      {st.details}
                    </div>
                  </div>

                  <div>
                    <StatusBadge status={st.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
