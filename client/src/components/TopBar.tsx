import React, { useState } from 'react';
import { Search, Send, KeyRound, LogOut, ShieldCheck, User } from 'lucide-react';

interface TopBarProps {
  pageTitle: string;
  activeTab: string;
  currentUser?: {
    id: string;
    username: string;
    role: 'DEVELOPER' | 'SENDER';
    fullName: string;
    mustChangeCredentials: boolean;
  } | null;
  onOpenSendModal: () => void;
  onBackToDashboard?: () => void;
  onSelectTab?: (tab: string) => void;
  onOpenChangeCredentials?: () => void;
  onSignOut?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  pageTitle,
  activeTab,
  currentUser,
  onOpenSendModal,
  onSelectTab,
  onOpenChangeCredentials,
  onSignOut
}) => {
  const isWhatsapp = activeTab === 'dashboard' || activeTab === 'history';
  const isEmail = activeTab === 'emailer';

  return (
    <header style={{
      height: 'var(--topbar-height)',
      backgroundColor: 'var(--uni-white)',
      borderBottom: '1px solid var(--uni-border-gray)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      {/* Page Title & Channel Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--uni-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            JECRC UNIVERSITY • OFFICIAL SYSTEM
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--uni-black)', lineHeight: 1.2 }}>
            {pageTitle}
          </h1>
        </div>

        {/* Dual Channel Tabs Switcher */}
        {onSelectTab && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#F1F5F9',
            padding: '3px',
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
            marginLeft: '8px'
          }}>
            <button
              onClick={() => onSelectTab('dashboard')}
              style={{
                border: 'none',
                backgroundColor: isWhatsapp ? '#FFFFFF' : 'transparent',
                color: isWhatsapp ? 'var(--uni-red)' : '#64748B',
                fontWeight: isWhatsapp ? 700 : 500,
                fontSize: '0.76rem',
                padding: '5px 14px',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: isWhatsapp ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              💬 WhatsApp Notices
            </button>
            <button
              onClick={() => onSelectTab('emailer')}
              style={{
                border: 'none',
                backgroundColor: isEmail ? '#FFFFFF' : 'transparent',
                color: isEmail ? 'var(--uni-red)' : '#64748B',
                fontWeight: isEmail ? 700 : 500,
                fontSize: '0.76rem',
                padding: '5px 14px',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: isEmail ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              ✉️ Email Broadcasts
            </button>
          </div>
        )}
      </div>

      {/* Right Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'var(--uni-light-gray)',
          border: '1px solid var(--uni-border-gray)',
          borderRadius: 'var(--radius-subtle)',
          padding: '6px 12px',
          width: '240px'
        }}>
          <Search size={14} color="#6B6B6B" />
          <input
            type="text"
            placeholder="Search notices, dates..."
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              fontSize: '0.8125rem',
              color: 'var(--uni-black)',
              width: '100%'
            }}
          />
        </div>

        {/* Staff Profile & Role Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderLeft: '1px solid var(--uni-border-gray)',
            paddingLeft: '16px'
          }}
        >
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: currentUser?.role === 'DEVELOPER' ? '#1E293B' : 'var(--uni-red)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.78rem',
            fontWeight: 800,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {currentUser?.username ? currentUser.username.slice(0, 2).toUpperCase() : 'UR'}
          </div>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--uni-black)', lineHeight: 1.1 }}>
              {currentUser?.username || 'Staff Member'}
            </div>
            <div style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              color: currentUser?.role === 'DEVELOPER' ? '#2563EB' : '#16A34A',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>{currentUser?.role === 'DEVELOPER' ? '🛡️ Developer Admin' : '✉️ Message Sender'}</span>
            </div>
          </div>

          {/* Quick Security & Sign Out Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
            {onOpenChangeCredentials && (
              <button
                onClick={onOpenChangeCredentials}
                title="Change Username or Password"
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EEF2F6')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
              >
                <KeyRound size={15} />
              </button>
            )}

            {onSignOut && (
              <button
                onClick={onSignOut}
                title="Sign Out of Portal"
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  border: '1px solid #FECACA',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEE2E2')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onOpenSendModal}
          className="btn btn-primary"
          style={{ padding: '8px 18px', fontWeight: 600 }}
        >
          <Send size={15} />
          <span>+ Send Notice</span>
        </button>
      </div>
    </header>
  );
};
