import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Users,
  Shield,
  ShieldCheck,
  KeyRound,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Lock,
  Mail,
  User,
  Power
} from 'lucide-react';
import { api } from '../api/client.js';

interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  role: 'DEVELOPER' | 'SENDER';
  mustChangeCredentials: boolean;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export const UserManagementView: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<'DEVELOPER' | 'SENDER'>('SENDER');
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await api.getUsers();
      if (res.success && Array.isArray(res.users)) {
        setUsers(res.users);
      }
    } catch (err: any) {
      console.error('Failed to load user profiles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let generated = '';
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await api.createUser({
        fullName,
        username,
        email: email.trim() || undefined,
        password,
        role,
        mustChangeCredentials: mustChangePassword
      });

      if (res.success) {
        setActionNotice({
          type: 'success',
          message: `User account '${username}' created successfully!`
        });
        setIsModalOpen(false);
        // Reset form
        setFullName('');
        setUsername('');
        setEmail('');
        setPassword('');
        setRole('SENDER');
        setMustChangePassword(true);
        await fetchUsers();
      } else {
        setFormError(res.error || 'Failed to create user account');
      }
    } catch (err: any) {
      setFormError(err.message || 'Network error creating user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.id === 'USR-DEV-001') {
      alert('Cannot delete the primary root developer account.');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete access for '${user.fullName} (${user.username})'?`)) {
      return;
    }

    try {
      const res = await api.deleteUser(user.id);
      if (res.success) {
        setActionNotice({
          type: 'success',
          message: `User account '${user.username}' deleted successfully.`
        });
        await fetchUsers();
      } else {
        alert(res.error || 'Failed to delete user');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    if (user.id === 'USR-DEV-001' && user.isActive) {
      alert('Cannot disable the primary root developer account.');
      return;
    }

    try {
      const newStatus = !user.isActive;
      const res = await api.toggleUserStatus(user.id, newStatus);
      if (res.success) {
        setActionNotice({
          type: 'success',
          message: `User account '${user.username}' has been ${newStatus ? 'activated' : 'disabled'}.`
        });
        await fetchUsers();
      } else {
        alert(res.error || 'Failed to toggle status');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q));
    return matchesRole && matchesQuery;
  });

  const totalAccounts = users.length;
  const activeAccounts = users.filter(u => u.isActive).length;
  const senderAccounts = users.filter(u => u.role === 'SENDER').length;
  const developerAccounts = users.filter(u => u.role === 'DEVELOPER').length;

  return (
    <div>
      {/* Action Notification Toast */}
      {actionNotice && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '4px',
          backgroundColor: actionNotice.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          border: actionNotice.type === 'success' ? '1px solid #10B981' : '1px solid #EF4444',
          color: actionNotice.type === 'success' ? '#065F46' : '#991B1B',
          fontSize: '0.84rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <span>{actionNotice.message}</span>
          <button
            onClick={() => setActionNotice(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '16px 20px', backgroundColor: 'var(--uni-white)' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--uni-muted)', fontWeight: 600 }}>
            Total User Profiles
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--uni-black)', marginTop: '4px' }}>
            {totalAccounts}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--uni-muted)', marginTop: '2px' }}>
            Provisioned portal users
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', backgroundColor: 'var(--uni-white)' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--uni-muted)', fontWeight: 600 }}>
            Active Accounts
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#15803D', marginTop: '4px' }}>
            {activeAccounts}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#15803D', marginTop: '2px' }}>
            Enabled for portal login
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', backgroundColor: 'var(--uni-white)' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--uni-muted)', fontWeight: 600 }}>
            Notice Senders
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#2563EB', marginTop: '4px' }}>
            {senderAccounts}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--uni-muted)', marginTop: '2px' }}>
            WhatsApp & Email senders
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', backgroundColor: 'var(--uni-white)' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--uni-muted)', fontWeight: 600 }}>
            Developer Admins
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#B91C1C', marginTop: '4px' }}>
            {developerAccounts}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--uni-muted)', marginTop: '2px' }}>
            Forensics & IT authorities
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ padding: '20px', backgroundColor: 'var(--uni-white)' }}>
        {/* Controls Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--uni-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search by name, username, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '34px', fontSize: '0.8125rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              {['ALL', 'SENDER', 'DEVELOPER'].map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: roleFilter === r ? '1px solid var(--uni-black)' : '1px solid var(--uni-border-gray)',
                    backgroundColor: roleFilter === r ? 'var(--uni-black)' : 'var(--uni-white)',
                    color: roleFilter === r ? '#FFFFFF' : 'var(--uni-black)',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {r === 'ALL' ? 'All Roles' : r}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={fetchUsers}
              className="btn btn-outline btn-sm"
              disabled={isLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => {
                setFormError(null);
                setIsModalOpen(true);
              }}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}
            >
              <UserPlus size={15} />
              <span>+ Create User Profile</span>
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--uni-border-gray)', textAlign: 'left', backgroundColor: '#FAFAFA' }}>
                <th style={{ padding: '10px 14px', fontSize: '0.72rem', color: 'var(--uni-muted)', textTransform: 'uppercase' }}>User Profile</th>
                <th style={{ padding: '10px 14px', fontSize: '0.72rem', color: 'var(--uni-muted)', textTransform: 'uppercase' }}>Username</th>
                <th style={{ padding: '10px 14px', fontSize: '0.72rem', color: 'var(--uni-muted)', textTransform: 'uppercase' }}>Role Access</th>
                <th style={{ padding: '10px 14px', fontSize: '0.72rem', color: 'var(--uni-muted)', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '10px 14px', fontSize: '0.72rem', color: 'var(--uni-muted)', textTransform: 'uppercase' }}>Security Policy</th>
                <th style={{ padding: '10px 14px', fontSize: '0.72rem', color: 'var(--uni-muted)', textTransform: 'uppercase' }}>Last Login</th>
                <th style={{ padding: '10px 14px', fontSize: '0.72rem', color: 'var(--uni-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px 0', textAlign: 'center', color: 'var(--uni-muted)' }}>
                    {isLoading ? 'Loading portal profiles...' : 'No user profiles found matching filter.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isRoot = u.id === 'USR-DEV-001';
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--uni-border-gray)', fontSize: '0.8125rem' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--uni-black)' }}>{u.fullName}</div>
                        {u.email && <div style={{ fontSize: '0.72rem', color: 'var(--uni-muted)' }}>{u.email}</div>}
                      </td>

                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#1E293B' }}>
                        {u.username}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        {u.role === 'DEVELOPER' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: '#FEF2F2',
                            color: '#991B1B',
                            fontWeight: 700,
                            fontSize: '0.72rem'
                          }}>
                            <Shield size={12} /> DEVELOPER
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: '#EFF6FF',
                            color: '#1E40AF',
                            fontWeight: 700,
                            fontSize: '0.72rem'
                          }}>
                            <Users size={12} /> SENDER
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        {u.isActive ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: '#15803D',
                            fontSize: '0.74rem',
                            fontWeight: 600
                          }}>
                            <CheckCircle2 size={13} /> Active
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: '#991B1B',
                            fontSize: '0.74rem',
                            fontWeight: 600
                          }}>
                            <XCircle size={13} /> Disabled
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        {u.mustChangeCredentials ? (
                          <span style={{
                            padding: '2px 7px',
                            borderRadius: '3px',
                            backgroundColor: '#FFFBEB',
                            color: '#B45309',
                            fontSize: '0.7rem',
                            fontWeight: 600
                          }}>
                            Reset on First Login
                          </span>
                        ) : (
                          <span style={{
                            padding: '2px 7px',
                            borderRadius: '3px',
                            backgroundColor: '#F3F4F6',
                            color: '#4B5563',
                            fontSize: '0.7rem'
                          }}>
                            Password Set
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 14px', fontSize: '0.74rem', color: 'var(--uni-muted)' }}>
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never logged in'}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={isRoot}
                            title={u.isActive ? 'Disable User Access' : 'Enable User Access'}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--uni-border-gray)',
                              backgroundColor: u.isActive ? '#FFF1F2' : '#F0FDF4',
                              color: u.isActive ? '#BE123C' : '#15803D',
                              cursor: isRoot ? 'not-allowed' : 'pointer',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              opacity: isRoot ? 0.5 : 1
                            }}
                          >
                            <Power size={12} />
                            {u.isActive ? 'Disable' : 'Enable'}
                          </button>

                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={isRoot}
                            title={isRoot ? 'Cannot delete root developer account' : 'Delete user profile'}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '4px',
                              border: '1px solid #FECACA',
                              backgroundColor: '#FEF2F2',
                              color: '#B91C1C',
                              cursor: isRoot ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              opacity: isRoot ? 0.3 : 1
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Profile Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--uni-white)',
            borderRadius: 'var(--radius-subtle)',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--uni-border-gray)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#FAFAFA'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} color="var(--uni-red)" />
                <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--uni-black)' }}>
                  Create New Portal User Profile
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--uni-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateUser} style={{ padding: '20px' }}>
              {formError && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '4px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #EF4444',
                  color: '#991B1B',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  <AlertCircle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Full Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--uni-black)', marginBottom: '5px' }}>
                    Full Name & Title <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User size={15} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--uni-muted)' }} />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Dr. Ramesh Verma / Admissions Desk"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      style={{ paddingLeft: '34px', fontSize: '0.84rem' }}
                      required
                    />
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--uni-black)', marginBottom: '5px' }}>
                    Username (Login Identifier) <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--uni-muted)' }} />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. admissions_desk / ramesh_v"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                      style={{ paddingLeft: '34px', fontSize: '0.84rem' }}
                      required
                    />
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--uni-muted)', marginTop: '3px' }}>
                    Lowercase letters, numbers, and underscores only.
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--uni-black)', marginBottom: '5px' }}>
                    Official Email (Optional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--uni-muted)' }} />
                    <input
                      type="email"
                      className="form-input"
                      placeholder="e.g. ramesh@jecrcu.edu.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ paddingLeft: '34px', fontSize: '0.84rem' }}
                    />
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--uni-black)', marginBottom: '5px' }}>
                    Portal Role & Permissions <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <label style={{
                      padding: '12px',
                      borderRadius: '4px',
                      border: role === 'SENDER' ? '2px solid #2563EB' : '1px solid var(--uni-border-gray)',
                      backgroundColor: role === 'SENDER' ? '#EFF6FF' : 'var(--uni-white)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="radio"
                          name="user_role"
                          checked={role === 'SENDER'}
                          onChange={() => setRole('SENDER')}
                        />
                        <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#1E40AF' }}>SENDER</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#4B5563' }}>
                        Send WhatsApp notices, templates, email broadcasts, and directory.
                      </span>
                    </label>

                    <label style={{
                      padding: '12px',
                      borderRadius: '4px',
                      border: role === 'DEVELOPER' ? '2px solid #B91C1C' : '1px solid var(--uni-border-gray)',
                      backgroundColor: role === 'DEVELOPER' ? '#FEF2F2' : 'var(--uni-white)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="radio"
                          name="user_role"
                          checked={role === 'DEVELOPER'}
                          onChange={() => setRole('DEVELOPER')}
                        />
                        <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#991B1B' }}>DEVELOPER</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#4B5563' }}>
                        Full access: IT forensics, DB queue, error traces, and user management.
                      </span>
                    </label>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--uni-black)' }}>
                      Initial Temporary Password <span style={{ color: 'red' }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--uni-red)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      🎲 Generate Secure Password
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={15} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--uni-muted)' }} />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ paddingLeft: '34px', fontSize: '0.84rem' }}
                      required
                    />
                  </div>
                </div>

                {/* Security Gate Checkbox */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    checked={mustChangePassword}
                    onChange={(e) => setMustChangePassword(e.target.checked)}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--uni-black)' }}>
                    Require user to change their password and username on first login
                  </span>
                </label>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--uni-border-gray)' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-outline btn-sm"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isSubmitting}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <UserPlus size={14} />
                  <span>{isSubmitting ? 'Creating Profile...' : 'Create & Authorize Access'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
