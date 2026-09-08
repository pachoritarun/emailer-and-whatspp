import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight, GraduationCap } from 'lucide-react';
import { api } from '../api/client.js';

interface LoginViewProps {
  onLoginSuccess: (user: {
    id: string;
    username: string;
    role: 'DEVELOPER' | 'SENDER';
    fullName: string;
    mustChangeCredentials: boolean;
  }, token: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.login(username.trim(), password);
      if (res.success && res.user && res.token) {
        localStorage.setItem('jecrc_auth_token', res.token);
        localStorage.setItem('jecrc_user', JSON.stringify(res.user));
        onLoginSuccess(res.user, res.token);
      } else {
        setErrorMessage(res.error || 'Authentication failed. Please check your credentials.');
      }
    } catch (err: any) {
      setErrorMessage('Unable to connect to authentication server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#0F172A',
      backgroundImage: 'radial-gradient(at 0% 0%, rgba(184, 0, 0, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(30, 58, 138, 0.2) 0px, transparent 50%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      boxSizing: 'border-box',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {/* Top University Brand Bar */}
        <div style={{
          backgroundColor: '#8B0000', // Institutional JECRC Crimson
          padding: '28px 32px',
          color: '#FFFFFF',
          textAlign: 'center',
          position: 'relative'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            marginBottom: '12px',
            border: '2px solid rgba(255, 255, 255, 0.3)'
          }}>
            <GraduationCap size={30} color="#FFFFFF" />
          </div>

          <div style={{ fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.85, fontWeight: 700 }}>
            JECRC UNIVERSITY
          </div>
          <h2 style={{ margin: '4px 0 0', fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Official Communication Portal
          </h2>
          <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '4px' }}>
            Dual-Channel WhatsApp & Bulk Email Dispatcher
          </div>
        </div>

        {/* Form Body */}
        <div style={{ padding: '32px' }}>
          <div style={{ marginBottom: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#15803D', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <ShieldCheck size={16} />
              <span>Encrypted Role-Based Access</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '4px' }}>
              Sign in with your assigned institutional credentials.
            </div>
          </div>

          {errorMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '6px',
              color: '#991B1B',
              fontSize: '0.84rem',
              marginBottom: '20px'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Username */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Username
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                border: '1.5px solid #CBD5E1',
                borderRadius: '8px',
                padding: '0 12px',
                backgroundColor: '#F8FAFC',
                transition: 'border-color 0.15s ease'
              }}>
                <User size={16} color="#94A3B8" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username (e.g. Developer or Sender)"
                  style={{
                    width: '100%',
                    padding: '11px 10px',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '0.9rem',
                    color: '#0F172A'
                  }}
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Password
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                border: '1.5px solid #CBD5E1',
                borderRadius: '8px',
                padding: '0 12px',
                backgroundColor: '#F8FAFC'
              }}>
                <Lock size={16} color="#94A3B8" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{
                    width: '100%',
                    padding: '11px 10px',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '0.9rem',
                    color: '#0F172A'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px 18px',
                backgroundColor: isLoading ? '#94A3B8' : '#B80000',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(184, 0, 0, 0.25)',
                transition: 'all 0.15s ease',
                marginTop: '6px'
              }}
            >
              {isLoading ? (
                <span>Authenticating with Database...</span>
              ) : (
                <>
                  <span>Sign In to Portal</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick Access Info Card */}
          <div style={{
            marginTop: '24px',
            padding: '14px',
            backgroundColor: '#F1F5F9',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            fontSize: '0.76rem',
            color: '#475569',
            lineHeight: 1.5
          }}>
            <div style={{ fontWeight: 700, color: '#1E293B', marginBottom: '4px' }}>
              🔒 Security & RBAC Roles Notice:
            </div>
            <div>• <b>Developer</b>: Full administrative forensics, low-level queue inspection, and Sender audit logs.</div>
            <div>• <b>Sender</b>: Clean, focused portal for sending official WhatsApp notices & bulk emails.</div>
            <div style={{ marginTop: '6px', color: '#B80000', fontWeight: 600 }}>
              * First-time login will prompt you to set your own personalized username and secure password.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
