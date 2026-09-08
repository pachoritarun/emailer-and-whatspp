import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { SystemHealth, DLQItem } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { ShieldCheck, Database, Layers, Cpu, Radio, RotateCcw, Ban, CheckCircle2 } from 'lucide-react';

export const SystemHealthView: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [dlq, setDlq] = useState<DLQItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    Promise.all([api.getSystemHealth(), api.getDLQ()]).then(([hRes, dRes]) => {
      setHealth(hRes);
      if (dRes.success) setDlq(dRes.items);
      setLoading(false);
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleRetry = async (jobId: number) => {
    const res = await api.retryDLQ(jobId);
    if (res.success) {
      alert(res.message);
      refresh();
    }
  };

  const handleIgnore = async (jobId: number) => {
    const res = await api.ignoreDLQ(jobId);
    if (res.success) {
      alert(res.message);
      refresh();
    }
  };

  return (
    <div>
      {/* Infrastructure Health Cards */}
      {health && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {/* Database */}
          <div className="uni-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="metric-card-title">MySQL 8 Database</span>
              <Database size={16} color="var(--uni-red)" />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>
              <StatusBadge status={health.components.database.status} />
            </div>
            <div className="metric-card-subtext">
              {health.components.database.engine}
            </div>
          </div>

          {/* Queue */}
          <div className="uni-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="metric-card-title">Durable Queue</span>
              <Layers size={16} color="var(--uni-red)" />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>
              {health.components.message_queue.depth} Jobs Pending
            </div>
            <div className="metric-card-subtext">
              {health.components.message_queue.locked} locked by active workers
            </div>
          </div>

          {/* Workers */}
          <div className="uni-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="metric-card-title">Workers (systemd)</span>
              <Cpu size={16} color="var(--uni-red)" />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>
              {health.components.workers.active_processes} Active Instances
            </div>
            <div className="metric-card-subtext">
              {health.components.workers.service_manager}
            </div>
          </div>

          {/* WhatsApp API */}
          <div className="uni-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="metric-card-title">Meta Cloud API</span>
              <Radio size={16} color="var(--uni-red)" />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>
              {health.components.whatsapp_api.latency_ms}ms Latency
            </div>
            <div className="metric-card-subtext">
              Quota Remaining: {health.components.whatsapp_api.rate_limit_remaining}
            </div>
          </div>
        </div>
      )}

      {/* Section 15: Dead Letter Queue (DLQ) & Manual Review */}
      <div className="uni-card">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          borderBottom: '1px solid var(--uni-border-gray)',
          paddingBottom: '12px'
        }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--uni-black)' }}>
              Dead-Letter Queue (DLQ) & Manual Forensic Review
            </h2>
            <div className="text-muted" style={{ fontSize: '0.8125rem' }}>
              Messages that exceeded maximum automatic retries (3 attempts). Zero phone numbers displayed.
            </div>
          </div>
          <button onClick={refresh} className="btn btn-secondary btn-sm">
            Refresh DLQ
          </button>
        </div>

        {dlq.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--uni-muted)' }}>
            <CheckCircle2 size={32} color="#2E7D32" style={{ margin: '0 auto 8px' }} />
            <div>Dead Letter Queue is empty. Zero abandoned message jobs.</div>
          </div>
        ) : (
          <div className="table-container">
            <table className="uni-table">
              <thead>
                <tr>
                  <th>Job UUID</th>
                  <th>Campaign Name</th>
                  <th>Recipient UUID</th>
                  <th>Correlation ID</th>
                  <th>Retries</th>
                  <th>Last Provider Error</th>
                  <th>Recommended Resolution</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dlq.map(item => (
                  <tr key={item.job_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600 }}>
                      {item.job_uuid}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {item.campaign_name}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                      {item.recipient_id}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--uni-muted)' }}>
                      {item.correlation_id}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ color: 'var(--uni-red)', fontWeight: 700 }}>{item.retry_count}</span>/{item.max_retries}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--uni-red)' }}>
                      {item.last_error}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--uni-muted)' }}>
                      {item.recommended_action}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleRetry(item.job_id)}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                          title="Retry Job"
                        >
                          <RotateCcw size={12} />
                          <span>Retry</span>
                        </button>
                        <button
                          onClick={() => handleIgnore(item.job_id)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                          title="Ignore Permanently"
                        >
                          <Ban size={12} />
                          <span>Ignore</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
