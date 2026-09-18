import React, { useState } from 'react';
import { SystemHealthView } from './SystemHealthView.js';
import { CorrelationTracerView } from './CorrelationTracerView.js';
import { CampaignDiagnosticsView } from './CampaignDiagnosticsView.js';
import { ImportLogsView } from './ImportLogsView.js';
import { AuditLogsView } from './AuditLogsView.js';
import { SenderActivityView } from './SenderActivityView.js';
import { UserManagementView } from './UserManagementView.js';
import { Activity, ShieldCheck, GitCommit, UploadCloud, FileSearch, ArrowLeft, UserCheck, Users } from 'lucide-react';

interface DeveloperConsoleViewProps {
  onBackToDashboard?: () => void;
}

export const DeveloperConsoleView: React.FC<DeveloperConsoleViewProps> = ({ onBackToDashboard }) => {
  const [subTab, setSubTab] = useState<'sender' | 'profiles' | 'health' | 'tracer' | 'diagnostics' | 'imports' | 'audit'>('profiles');

  return (
    <div>
      {/* Return to Normal Profile Quick Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px',
        backgroundColor: 'var(--uni-white)',
        border: '1px solid var(--uni-border-gray)',
        borderRadius: 'var(--radius-subtle)',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--uni-red)' }}></span>
          <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--uni-black)' }}>
            Developer & IT Forensics Console
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--uni-muted)' }}>
            • Viewing low-level queue, DLQ retries & trace logs
          </span>
        </div>

        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '0.8125rem' }}
          >
            <ArrowLeft size={14} />
            <span>← Return to Normal Communication Dashboard</span>
          </button>
        )}
      </div>

      {/* Dev Console Header Banner */}
      <div style={{
        padding: '16px 20px',
        backgroundColor: '#111111',
        borderRadius: 'var(--radius-subtle)',
        color: '#FFFFFF',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#AAA' }}>
            IT & DevOps Forensics
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FFFFFF' }}>
            System Forensics & Observability
          </h2>
          <div style={{ fontSize: '0.78rem', color: '#CCC', marginTop: '2px' }}>
            MySQL 8 Queue Instrumentation, Dead-Letter Queue (DLQ), Correlation Tracing, and Webhook Deduplication.
          </div>
        </div>

        {/* Sub Navigation Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSubTab('profiles')}
            className="btn btn-sm"
            style={{
              backgroundColor: subTab === 'profiles' ? 'var(--uni-red)' : '#222',
              color: '#FFFFFF',
              border: subTab === 'profiles' ? '1px solid #DC2626' : '1px solid #333',
              fontWeight: subTab === 'profiles' ? 700 : 500
            }}
          >
            <Users size={14} />
            <span>User Profiles & Access</span>
          </button>

          <button
            onClick={() => setSubTab('sender')}
            className="btn btn-sm"
            style={{
              backgroundColor: subTab === 'sender' ? 'var(--uni-red)' : '#222',
              color: '#FFFFFF',
              border: subTab === 'sender' ? '1px solid #DC2626' : '1px solid #333',
              fontWeight: subTab === 'sender' ? 700 : 500
            }}
          >
            <UserCheck size={14} />
            <span>Sender Activity Trail</span>
          </button>

          <button
            onClick={() => setSubTab('health')}
            className="btn btn-sm"
            style={{
              backgroundColor: subTab === 'health' ? 'var(--uni-red)' : '#222',
              color: '#FFFFFF',
              border: 'none'
            }}
          >
            <ShieldCheck size={14} />
            <span>Health & DLQ</span>
          </button>

          <button
            onClick={() => setSubTab('tracer')}
            className="btn btn-sm"
            style={{
              backgroundColor: subTab === 'tracer' ? 'var(--uni-red)' : '#222',
              color: '#FFFFFF',
              border: 'none'
            }}
          >
            <GitCommit size={14} />
            <span>Correlation Tracer</span>
          </button>

          <button
            onClick={() => setSubTab('diagnostics')}
            className="btn btn-sm"
            style={{
              backgroundColor: subTab === 'diagnostics' ? 'var(--uni-red)' : '#222',
              color: '#FFFFFF',
              border: 'none'
            }}
          >
            <Activity size={14} />
            <span>Forensic Audit</span>
          </button>

          <button
            onClick={() => setSubTab('imports')}
            className="btn btn-sm"
            style={{
              backgroundColor: subTab === 'imports' ? 'var(--uni-red)' : '#222',
              color: '#FFFFFF',
              border: 'none'
            }}
          >
            <UploadCloud size={14} />
            <span>Import Logs</span>
          </button>

          <button
            onClick={() => setSubTab('audit')}
            className="btn btn-sm"
            style={{
              backgroundColor: subTab === 'audit' ? 'var(--uni-red)' : '#222',
              color: '#FFFFFF',
              border: 'none'
            }}
          >
            <FileSearch size={14} />
            <span>Audit Trail</span>
          </button>
        </div>
      </div>

      {/* Render Sub Tab */}
      {subTab === 'profiles' && <UserManagementView />}
      {subTab === 'sender' && <SenderActivityView />}
      {subTab === 'health' && <SystemHealthView />}
      {subTab === 'tracer' && <CorrelationTracerView />}
      {subTab === 'diagnostics' && <CampaignDiagnosticsView />}
      {subTab === 'imports' && <ImportLogsView />}
      {subTab === 'audit' && <AuditLogsView />}
    </div>
  );
};

