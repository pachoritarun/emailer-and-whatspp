import React, { useState } from 'react';
import { ShieldCheck, Lock, User, KeyRound, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { api } from '../api/client.js';

interface FirstTimeSetupModalProps {
  isOpen: boolean;
  isMandatory: boolean; // If true, cannot dismiss without saving
  currentUser: {
    id: string;
    username: string;
    role: 'DEVELOPER' | 'SENDER';
    fullName: string;
    mustChangeCredentials: boolean;
  };
  onComplete: (updatedUser: any) => void;
  onClose?: () => void;
}

export const FirstTimeSetupModal: React.FC<FirstTimeSetupModalProps> = ({
  isOpen,
  isMandatory,
  currentUser,
  onComplete,
  onClose
}) => {
  const [newUsername, setNewUsername] = useState<string>(currentUser.username || '');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUser = newUsername.trim();
    if (!trimmedUser || trimmedUser.length < 3) {
      setErrorMessage('Username must be at least 3 characters long.');
      return;
    }

    if (isMandatory && (!newPassword || newPassword.length < 6)) {
      setErrorMessage('Please provide a secure new password with at least 6 characters.');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your confirmation password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.changeCredentials(trimmedUser, newPassword || undefined, currentUser.id);
      if (res.success && res.user) {
        setSuccessMessage('Credentials updated and encrypted successfully!');
        const updated = {
          ...currentUser,
          username: res.user.username,
          mustChangeCredentials: false
        };
        localStorage.setItem('jecrc_user', JSON.stringify(updated));

        setTimeout(() => {
          onComplete(updated);
        }, 1200);
      } else {
        setErrorMessage(res.error || 'Failed to update credentials. That username may already be taken.');
      }
    } catch (err: any) {
      setErrorMessage('Error communicating with database server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.82)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        {/* Modal Header */}
        <div style={{
          backgroundColor: '#0F172A',
          padding: '20px 24px',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: isMandatory ? '#F59E0B' : '#38BDF8',
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '4px'
            }}>
              <ShieldCheck size={14} />
              <span>{isMandatory ? 'First-Time Security Requirement' : 'Account Security Settings'}</span>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#FFFFFF' }}>
              {isMandatory ? 'Personalize Your Account' : 'Change Username & Password'}
            </h3>
            <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '4px' }}>
              {isMandatory
                ? 'For security compliance, please choose your personal username and a private password.'
                : 'Update your login credentials stored encrypted in MySQL database.'}
            </div>
          </div>

          {!isMandatory && onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {errorMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '6px',
              color: '#991B1B',
              fontSize: '0.84rem',
              marginBottom: '18px'
            }}>
              <AlertCircle size={17} style={{ flexShrink: 0 }} />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: '6px',
              color: '#166534',
              fontSize: '0.84rem',
              marginBottom: '18px'
            }}>
              <CheckCircle2 size={17} style={{ flexShrink: 0 }} />
              <div>{successMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Username Input */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                New Username <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                border: '1.5px solid #CBD5E1',
                borderRadius: '8px',
                padding: '0 12px',
                backgroundColor: '#F8FAFC'
              }}>
                <User size={16} color="#64748B" />
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter personalized username"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '0.88rem',
                    color: '#0F172A'
                  }}
                  required
                />
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>
                Current role: <b>{currentUser.role}</b>
              </div>
            </div>

            {/* New Password Input */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                New Password {isMandatory && <span style={{ color: '#DC2626' }}>*</span>}
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                border: '1.5px solid #CBD5E1',
                borderRadius: '8px',
                padding: '0 12px',
                backgroundColor: '#F8FAFC'
              }}>
                <KeyRound size={16} color="#64748B" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={isMandatory ? "Enter strong password (min 6 characters)" : "Leave blank to keep existing password"}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '0.88rem',
                    color: '#0F172A'
                  }}
                />
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Confirm New Password {newPassword && <span style={{ color: '#DC2626' }}>*</span>}
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                border: '1.5px solid #CBD5E1',
                borderRadius: '8px',
                padding: '0 12px',
                backgroundColor: '#F8FAFC'
              }}>
                <Lock size={16} color="#64748B" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '0.88rem',
                    color: '#0F172A'
                  }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              {!isMandatory && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: '#F1F5F9',
                    color: '#475569',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  flex: 2,
                  padding: '10px 16px',
                  backgroundColor: isLoading ? '#94A3B8' : '#B80000',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(184, 0, 0, 0.25)'
                }}
              >
                {isLoading ? 'Encrypting & Saving...' : 'Save & Continue to Portal'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
