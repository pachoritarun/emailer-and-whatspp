import React, { useState, useEffect } from 'react';
import {
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Smartphone,
  Tag,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Phone,
  CornerDownLeft,
  X,
  AlertCircle,
  Trash2,
  Eye
} from 'lucide-react';
import { api } from '../api/client.js';

interface TemplateItem {
  id: string;
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  language: string;
  header_type?: 'NONE' | 'TEXT' | 'IMAGE' | 'DOCUMENT';
  header_text?: string;
  body: string;
  footer_text?: string;
  sampleVariables?: string[];
  buttons?: any[];
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  created_at?: string;
}

export const TemplatesView: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Studio Modal State
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null);

  // Form State
  const [tplName, setTplName] = useState<string>('');
  const [tplCategory, setTplCategory] = useState<'UTILITY' | 'MARKETING'>('UTILITY');
  const [tplLanguage, setTplLanguage] = useState<string>('en');
  const [tplHeaderType, setTplHeaderType] = useState<'NONE' | 'TEXT' | 'IMAGE' | 'DOCUMENT'>('NONE');
  const [tplHeaderText, setTplHeaderText] = useState<string>('');
  const [tplHeaderSample, setTplHeaderSample] = useState<string>('');
  const [tplBody, setTplBody] = useState<string>('Dear {{1}}, welcome to JECRC University. Your registration for {{2}} is confirmed.');
  const [tplFooter, setTplFooter] = useState<string>('JECRC University • Official Portal');
  const [sampleVars, setSampleVars] = useState<Record<string, string>>({
    '1': 'Aarav Sharma',
    '2': 'Computer Science Engineering'
  });
  const [buttons, setButtons] = useState<Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string; phone_number?: string }>>([
    { type: 'URL', text: 'Visit University Portal', url: 'https://ai.jecrcuniversity.edu.in' }
  ]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await api.getTemplates();
      if (res.success && Array.isArray(res.templates)) {
        setTemplates(res.templates);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSyncMeta = async () => {
    setIsSyncing(true);
    try {
      const res = await api.syncMetaTemplates();
      if (res.success) {
        await fetchTemplates();
      } else {
        alert(res.error || 'Sync notice: Ensure Meta WABA ID & Token are configured in .env');
      }
    } catch (err: any) {
      alert('Failed to connect to Meta API: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Are you sure you want to delete template '${name}'?`)) return;
    try {
      await api.deleteTemplate(name);
      await fetchTemplates();
    } catch (err) {
      console.error('Error deleting template:', err);
    }
  };

  // Variable Detection & Sample Sync
  const detectedVars: string[] = [];
  const varMatches = tplBody.match(/\{\{(\d+)\}\}/g);
  if (varMatches) {
    varMatches.forEach(m => {
      const num = m.replace(/[\{\}]/g, '');
      if (!detectedVars.includes(num)) detectedVars.push(num);
    });
  }

  const handleInsertVariable = () => {
    const nextNum = detectedVars.length + 1;
    setTplBody(prev => prev + ` {{${nextNum}}}`);
    setSampleVars(prev => ({ ...prev, [String(nextNum)]: `Sample ${nextNum}` }));
  };

  const handleAddButton = (type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER') => {
    if (buttons.length >= 3) {
      alert('WhatsApp allows a maximum of 3 buttons per template.');
      return;
    }
    if (type === 'QUICK_REPLY') {
      setButtons(prev => [...prev, { type: 'QUICK_REPLY', text: 'Confirm' }]);
    } else if (type === 'URL') {
      setButtons(prev => [...prev, { type: 'URL', text: 'Open Link', url: 'https://ai.jecrcuniversity.edu.in' }]);
    } else if (type === 'PHONE_NUMBER') {
      setButtons(prev => [...prev, { type: 'PHONE_NUMBER', text: 'Call Desk', phone_number: '+911412771500' }]);
    }
  };

  const handleRemoveButton = (idx: number) => {
    setButtons(prev => prev.filter((_, i) => i !== idx));
  };

  // Build simulated preview text replacing {{1}} with samples
  const getRenderedBodyPreview = () => {
    let text = tplBody;
    detectedVars.forEach(num => {
      const sampleVal = sampleVars[num] || `[Variable ${num}]`;
      const regex = new RegExp(`\\{\\{${num}\\}\\}`, 'g');
      text = text.replace(regex, sampleVal);
    });
    return text;
  };

  const handleSubmitStudio = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = tplName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!cleanName || cleanName.length < 3) {
      setErrorMessage('Template name must be at least 3 characters (lowercase letters and underscores only).');
      return;
    }

    if (!tplBody.trim()) {
      setErrorMessage('Template body text cannot be empty.');
      return;
    }

    const samplesArray = detectedVars.map(num => sampleVars[num] || `SampleVal${num}`);

    setIsSubmitting(true);
    try {
      const payload = {
        name: cleanName,
        category: tplCategory,
        language: tplLanguage,
        header_type: tplHeaderType,
        header_text: tplHeaderType === 'TEXT' ? tplHeaderText : undefined,
        header_sample: tplHeaderSample || undefined,
        body_text: tplBody,
        sample_variables: samplesArray,
        footer_text: tplFooter || undefined,
        buttons: buttons.length > 0 ? buttons : undefined
      };

      const res = await api.createAndSubmitTemplate(payload);
      if (res.success) {
        setSuccessMessage(`Template '${cleanName}' successfully submitted and approved!`);
        setTimeout(() => {
          setIsStudioOpen(false);
          fetchTemplates();
          // Reset form
          setTplName('');
          setErrorMessage(null);
          setSuccessMessage(null);
        }, 1200);
      } else {
        setErrorMessage(res.error || 'Failed to create template on Meta.');
      }
    } catch (err: any) {
      setErrorMessage('Error communicating with server: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesCat = categoryFilter === 'ALL' || t.category === categoryFilter;
    const matchesSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.body.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const approvedCount = templates.filter(t => t.status === 'APPROVED').length;
  const pendingCount = templates.filter(t => t.status === 'PENDING').length;
  const rejectedCount = templates.filter(t => t.status === 'REJECTED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner & Action Header */}
      <div style={{
        backgroundColor: '#FFFFFF',
        padding: '24px 28px',
        borderRadius: '10px',
        border: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div>
          <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#B80000', fontWeight: 700 }}>
            INSTITUTIONAL WHATSAPP BROADCASTS
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', margin: '4px 0 0' }}>
            In-Portal WhatsApp Template Studio
          </h2>
          <div style={{ fontSize: '0.84rem', color: '#64748B', marginTop: '4px' }}>
            Create, preview, submit to Meta Cloud API, and manage templates directly without leaving the university portal.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleSyncMeta}
            disabled={isSyncing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              color: '#334155',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: isSyncing ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync from Meta'}</span>
          </button>

          <button
            onClick={() => {
              setErrorMessage(null);
              setSuccessMessage(null);
              setIsStudioOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              backgroundColor: '#B80000',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(184, 0, 0, 0.25)'
            }}
          >
            <Plus size={16} />
            <span>+ Create WhatsApp Template</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Total Templates</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>{templates.length}</div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Available in JECRC portal</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Approved & Live</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#16A34A', marginTop: '4px' }}>{approvedCount}</div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Ready for immediate broadcast</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Pending Meta Review</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>{pendingCount}</div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Meta automated verification</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Utility Rate</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>
            {templates.length > 0 ? Math.round((templates.filter(t => t.category === 'UTILITY').length / templates.length) * 100) : 100}%
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Fast-track approval category</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        backgroundColor: '#FFFFFF',
        padding: '14px 20px',
        borderRadius: '8px',
        border: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 12px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            width: '320px'
          }}>
            <Search size={15} color="#64748B" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates by name or body..."
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.84rem',
                color: '#0F172A',
                width: '100%'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {['ALL', 'UTILITY', 'MARKETING'].map((cat) => {
              const isSelected = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: '1px solid ' + (isSelected ? '#B80000' : '#E2E8F0'),
                    backgroundColor: isSelected ? '#B80000' : '#FFFFFF',
                    color: isSelected ? '#FFFFFF' : '#475569',
                    fontSize: '0.76rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer'
                  }}
                >
                  {cat === 'ALL' ? 'All Categories' : cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Templates Table */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '8px',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <th style={{ padding: '12px 18px', fontWeight: 600 }}>Template Name</th>
              <th style={{ padding: '12px 18px', fontWeight: 600 }}>Category</th>
              <th style={{ padding: '12px 18px', fontWeight: 600 }}>Format</th>
              <th style={{ padding: '12px 18px', fontWeight: 600 }}>Message Content</th>
              <th style={{ padding: '12px 18px', fontWeight: 600, textAlign: 'center' }}>Meta Status</th>
              <th style={{ padding: '12px 18px', fontWeight: 600, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTemplates.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                  {isLoading ? 'Loading templates...' : 'No templates found. Click "+ Create WhatsApp Template" to design your first one!'}
                </td>
              </tr>
            ) : (
              filteredTemplates.map(t => (
                <tr key={t.id || t.name} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: 700, color: '#0F172A', fontFamily: 'monospace', fontSize: '0.88rem' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Language: {t.language}</div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: t.category === 'UTILITY' ? '#EFF6FF' : '#FDF4FF',
                      color: t.category === 'UTILITY' ? '#1D4ED8' : '#A21CAF'
                    }}>
                      <Tag size={11} /> {t.category}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', color: '#64748B' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#334155' }}>
                      {t.header_type || 'TEXT'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', maxWidth: '380px' }}>
                    <div style={{
                      fontSize: '0.8rem',
                      color: '#334155',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {t.body}
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                    {t.status === 'APPROVED' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#15803D', fontWeight: 700, fontSize: '0.76rem' }}>
                        <CheckCircle2 size={15} /> Approved
                      </span>
                    )}
                    {t.status === 'PENDING' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#D97706', fontWeight: 700, fontSize: '0.76rem' }}>
                        <Clock size={15} /> Pending Meta
                      </span>
                    )}
                    {t.status === 'REJECTED' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#DC2626', fontWeight: 700, fontSize: '0.76rem' }}>
                        <XCircle size={15} /> Rejected
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <button
                        onClick={() => setPreviewTemplate(t)}
                        title="Preview on Phone"
                        style={{
                          padding: '6px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#F8FAFC',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#475569'
                        }}
                      >
                        <Eye size={14} />
                      </button>

                      <button
                        onClick={() => handleDelete(t.name)}
                        title="Delete Template"
                        style={{
                          padding: '6px',
                          border: '1px solid #FECACA',
                          backgroundColor: '#FEF2F2',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#DC2626'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* INTERACTIVE TEMPLATE STUDIO BUILDER MODAL */}
      {/* ========================================================================= */}
      {isStudioOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '1060px',
            maxHeight: '92vh',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)'
          }}>
            {/* Studio Header */}
            <div style={{
              padding: '18px 24px',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #1E293B'
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#38BDF8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  META GRAPH API V19.0 DIRECT SUBMISSION
                </div>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.25rem', fontWeight: 800 }}>
                  WhatsApp Creative Template Studio
                </h3>
              </div>

              <button
                onClick={() => setIsStudioOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Studio Body: Split View (Builder on Left, Phone on Right) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', flex: 1, overflowY: 'auto' }}>
              {/* Form Builder Column */}
              <div style={{ padding: '24px', borderRight: '1px solid #E2E8F0', overflowY: 'auto' }}>
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
                    marginBottom: '16px'
                  }}>
                    <AlertCircle size={18} style={{ flexShrink: 0 }} />
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
                    marginBottom: '16px'
                  }}>
                    <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                    <div>{successMessage}</div>
                  </div>
                )}

                <form onSubmit={handleSubmitStudio} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Row: Name & Category */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                        Template Name <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={tplName}
                        onChange={(e) => setTplName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                        placeholder="e.g. exam_hall_ticket_2026"
                        required
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1.5px solid #CBD5E1',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontFamily: 'monospace'
                        }}
                      />
                      <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '2px' }}>
                        Lowercase letters and underscores only.
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                        Category
                      </label>
                      <select
                        value={tplCategory}
                        onChange={(e: any) => setTplCategory(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1.5px solid #CBD5E1',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          backgroundColor: '#FFFFFF'
                        }}
                      >
                        <option value="UTILITY">UTILITY (Fastest AI Approval)</option>
                        <option value="MARKETING">MARKETING (Offers & Events)</option>
                      </select>
                    </div>
                  </div>

                  {/* Header Selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Header Media / Text (Optional)
                    </label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      {['NONE', 'TEXT', 'IMAGE', 'DOCUMENT'].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setTplHeaderType(h as any)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '6px',
                            border: '1px solid ' + (tplHeaderType === h ? '#B80000' : '#CBD5E1'),
                            backgroundColor: tplHeaderType === h ? '#FEF2F2' : '#FFFFFF',
                            color: tplHeaderType === h ? '#B80000' : '#475569',
                            fontSize: '0.78rem',
                            fontWeight: tplHeaderType === h ? 700 : 500,
                            cursor: 'pointer'
                          }}
                        >
                          {h === 'NONE' ? 'No Header' : h}
                        </button>
                      ))}
                    </div>

                    {tplHeaderType === 'TEXT' && (
                      <input
                        type="text"
                        value={tplHeaderText}
                        onChange={(e) => setTplHeaderText(e.target.value)}
                        placeholder="e.g. JECRC Examination Notice"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1.5px solid #CBD5E1',
                          borderRadius: '6px',
                          fontSize: '0.85rem'
                        }}
                      />
                    )}

                    {(tplHeaderType === 'IMAGE' || tplHeaderType === 'DOCUMENT') && (
                      <div style={{
                        padding: '10px 14px',
                        backgroundColor: '#F8FAFC',
                        border: '1px dashed #CBD5E1',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        color: '#64748B'
                      }}>
                        📁 <b>{tplHeaderType} Header Active</b>: Senders will upload or link the image/PDF file when dispatching the notice.
                      </div>
                    )}
                  </div>

                  {/* Message Body */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                        Message Body <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleInsertVariable}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#2563EB',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        + Insert Variable &#123;&#123;{detectedVars.length + 1}&#125;&#125;
                      </button>
                    </div>

                    <textarea
                      value={tplBody}
                      onChange={(e) => setTplBody(e.target.value)}
                      rows={5}
                      maxLength={1024}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1.5px solid #CBD5E1',
                        borderRadius: '6px',
                        fontSize: '0.88rem',
                        lineHeight: 1.4,
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                      placeholder="Type your WhatsApp notice text here..."
                      required
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748B', marginTop: '2px' }}>
                      <span>Use &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125; for student name, roll number, course, etc.</span>
                      <span>{tplBody.length} / 1024</span>
                    </div>
                  </div>

                  {/* Variable Samples (Required by Meta for Approval) */}
                  {detectedVars.length > 0 && (
                    <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                        Variable Test Samples (Required by Meta review AI):
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                        {detectedVars.map(v => (
                          <div key={v}>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: '#475569', fontWeight: 600, marginBottom: '2px' }}>
                              Sample for &#123;&#123;{v}&#125;&#125;:
                            </label>
                            <input
                              type="text"
                              value={sampleVars[v] || ''}
                              onChange={(e) => setSampleVars({ ...sampleVars, [v]: e.target.value })}
                              placeholder={`e.g. Value ${v}`}
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                border: '1px solid #CBD5E1',
                                borderRadius: '4px',
                                fontSize: '0.8rem'
                              }}
                              required
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer Text */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Footer Text (Optional)
                    </label>
                    <input
                      type="text"
                      value={tplFooter}
                      onChange={(e) => setTplFooter(e.target.value)}
                      placeholder="e.g. JECRC University • Official Portal"
                      maxLength={60}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1.5px solid #CBD5E1',
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>

                  {/* Interactive Buttons */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                        Action Buttons (Optional, max 3)
                      </label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleAddButton('URL')}
                          style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
                        >
                          + Website Link
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddButton('QUICK_REPLY')}
                          style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
                        >
                          + Quick Reply
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {buttons.map((btn, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', width: '80px' }}>
                            {btn.type === 'URL' ? '🔗 Link' : '💬 Reply'}
                          </span>
                          <input
                            type="text"
                            value={btn.text}
                            onChange={(e) => {
                              const copy = [...buttons];
                              copy[idx].text = e.target.value;
                              setButtons(copy);
                            }}
                            placeholder="Button Label"
                            style={{ flex: 1, padding: '6px 10px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '0.8rem' }}
                            required
                          />
                          {btn.type === 'URL' && (
                            <input
                              type="text"
                              value={btn.url || ''}
                              onChange={(e) => {
                                const copy = [...buttons];
                                copy[idx].url = e.target.value;
                                setButtons(copy);
                              }}
                              placeholder="https://..."
                              style={{ flex: 1.5, padding: '6px 10px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '0.8rem' }}
                              required
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveButton(idx)}
                            style={{ background: 'transparent', border: 'none', color: '#DC2626', cursor: 'pointer' }}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Submit Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setIsStudioOpen(false)}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#475569',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      style={{
                        padding: '10px 22px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: isSubmitting ? '#94A3B8' : '#B80000',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 12px rgba(184, 0, 0, 0.25)'
                      }}
                    >
                      {isSubmitting ? 'Submitting to Meta...' : 'Submit to WhatsApp for Approval'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Real-time Phone Mockup Column */}
              <div style={{
                backgroundColor: '#E5DDD5',
                backgroundImage: 'radial-gradient(rgba(0,0,0,0.06) 1px, transparent 1px)',
                backgroundSize: '16px 16px',
                padding: '30px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflowY: 'auto'
              }}>
                {/* Phone Frame */}
                <div style={{
                  width: '320px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '24px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                  border: '8px solid #1E293B',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {/* Phone Header */}
                  <div style={{ backgroundColor: '#075E54', color: '#FFFFFF', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FFFFFF', color: '#075E54', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem' }}>
                      JU
                    </div>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        JECRC University <CheckCircle2 size={13} color="#25D366" />
                      </div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>Official Notification Gateway</div>
                    </div>
                  </div>

                  {/* Chat Background & Message Bubble */}
                  <div style={{
                    padding: '16px 12px',
                    backgroundColor: '#EFEAE2',
                    minHeight: '380px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start'
                  }}>
                    {/* Message Card */}
                    <div style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                      position: 'relative'
                    }}>
                      {/* Media Header Preview */}
                      {tplHeaderType === 'IMAGE' && (
                        <div style={{ height: '120px', backgroundColor: '#CBD5E1', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', marginBottom: '8px' }}>
                          <ImageIcon size={32} />
                        </div>
                      )}
                      {tplHeaderType === 'DOCUMENT' && (
                        <div style={{ padding: '8px', backgroundColor: '#F1F5F9', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1E293B', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 700 }}>
                          <FileText size={20} color="#DC2626" />
                          <span>Official_Notice_Document.pdf</span>
                        </div>
                      )}
                      {tplHeaderType === 'TEXT' && tplHeaderText && (
                        <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.88rem', marginBottom: '6px' }}>
                          {tplHeaderText}
                        </div>
                      )}

                      {/* Body Preview */}
                      <div style={{ fontSize: '0.82rem', color: '#111827', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                        {getRenderedBodyPreview()}
                      </div>

                      {/* Footer Preview */}
                      {tplFooter && (
                        <div style={{ fontSize: '0.68rem', color: '#6B7280', marginTop: '8px' }}>
                          {tplFooter}
                        </div>
                      )}

                      {/* Timestamp */}
                      <div style={{ fontSize: '0.62rem', color: '#9CA3AF', textAlign: 'right', marginTop: '4px' }}>
                        10:30 AM ✓✓
                      </div>

                      {/* Buttons Preview */}
                      {buttons.length > 0 && (
                        <div style={{ borderTop: '1px solid #F3F4F6', marginTop: '8px', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {buttons.map((btn, idx) => (
                            <div key={idx} style={{ padding: '6px', textAlign: 'center', color: '#00A884', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderBottom: idx < buttons.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                              {btn.type === 'URL' && <ExternalLink size={12} />}
                              {btn.type === 'QUICK_REPLY' && <CornerDownLeft size={12} />}
                              {btn.type === 'PHONE_NUMBER' && <Phone size={12} />}
                              <span>{btn.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK PREVIEW POPUP */}
      {/* ========================================================================= */}
      {previewTemplate && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{ width: '360px', backgroundColor: '#FFFFFF', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '14px 18px', backgroundColor: '#075E54', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{previewTemplate.name}</div>
              <button onClick={() => setPreviewTemplate(null)} style={{ background: 'transparent', border: 'none', color: '#FFF', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#EFEAE2' }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', fontSize: '0.82rem', lineHeight: 1.45 }}>
                {previewTemplate.body}
                {previewTemplate.footer_text && (
                  <div style={{ fontSize: '0.68rem', color: '#6B7280', marginTop: '8px' }}>
                    {previewTemplate.footer_text}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
