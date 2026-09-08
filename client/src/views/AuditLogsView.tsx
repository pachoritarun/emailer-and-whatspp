import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { AuditLog } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { ShieldCheck, FileSearch } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    api.getAuditLogs().then(res => {
      if (res.success) setLogs(res.logs);
    });
  }, []);

  return (
    <div className="uni-card">
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.1rem' }}>Administrative Forensic Audit Trail (Section 11)</h2>
        <div className="text-muted" style={{ fontSize: '0.8125rem' }}>
          Immutable records of all administrative actions. Phone numbers and authentication secrets are strictly scrubbed by the privacy gateway before write.
        </div>
      </div>

      <div className="table-container">
        <table className="uni-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Operator / Role</th>
              <th>Target Entity</th>
              <th>Entity ID</th>
              <th>IP Address</th>
              <th>Outcome</th>
              <th>Audit Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td style={{ fontSize: '0.78rem', color: 'var(--uni-muted)', whiteSpace: 'nowrap' }}>
                  {new Date(l.created_at).toLocaleString()}
                </td>
                <td style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                  {l.action}
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{l.user_id || 'SYSTEM'}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--uni-muted)' }}>{l.user_role}</div>
                </td>
                <td style={{ fontSize: '0.8125rem' }}>
                  {l.entity}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  {l.entity_id || '—'}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--uni-muted)' }}>
                  {l.ip_address}
                </td>
                <td>
                  <StatusBadge status={l.success ? 'APPROVED' : 'FAILED'} />
                </td>
                <td style={{ fontSize: '0.75rem', color: 'var(--uni-muted)' }}>
                  {l.metadata ? JSON.stringify(l.metadata) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
