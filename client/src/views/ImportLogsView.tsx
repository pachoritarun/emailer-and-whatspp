import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { ImportLog } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { UploadCloud, CheckCircle2 } from 'lucide-react';

export const ImportLogsView: React.FC = () => {
  const [logs, setLogs] = useState<ImportLog[]>([]);

  useEffect(() => {
    api.getImportLogs().then(res => {
      if (res.success) setLogs(res.import_logs);
    });
  }, []);

  return (
    <div className="uni-card">
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.1rem' }}>Excel Registry Import History (Section 12)</h2>
        <div className="text-muted" style={{ fontSize: '0.8125rem' }}>
          Every file ingestion is assigned a unique tracking code (IMP-YYYYMMDD-XXXXXX) with complete forensic accounting of imported vs. rejected rows.
        </div>
      </div>

      <div className="table-container">
        <table className="uni-table">
          <thead>
            <tr>
              <th>Import Code</th>
              <th>Filename</th>
              <th style={{ textAlign: 'right' }}>Detected</th>
              <th style={{ textAlign: 'right' }}>Imported</th>
              <th style={{ textAlign: 'right' }}>Rejected</th>
              <th style={{ textAlign: 'right' }}>Invalid Phone</th>
              <th style={{ textAlign: 'right' }}>Duration</th>
              <th>Status</th>
              <th>Ingested At</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.78rem' }}>
                  {l.import_code}
                </td>
                <td style={{ fontWeight: 500, fontSize: '0.8125rem' }}>
                  {l.filename}
                </td>
                <td style={{ textAlign: 'right' }}>{l.rows_detected.toLocaleString()}</td>
                <td style={{ textAlign: 'right', color: '#1B5E20', fontWeight: 600 }}>
                  {l.rows_imported.toLocaleString()}
                </td>
                <td style={{ textAlign: 'right', color: l.rows_rejected > 0 ? 'var(--uni-red)' : 'inherit', fontWeight: 600 }}>
                  {l.rows_rejected.toLocaleString()}
                </td>
                <td style={{ textAlign: 'right', color: l.invalid_phone_records > 0 ? 'var(--uni-red)' : 'inherit' }}>
                  {l.invalid_phone_records}
                </td>
                <td style={{ textAlign: 'right' }}>{l.processing_duration_ms}ms</td>
                <td>
                  <StatusBadge status={l.status} />
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--uni-muted)' }}>
                  {new Date(l.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
