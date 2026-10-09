import React, { useState, useEffect } from 'react';
import { X, Send, Users, Sparkles, CheckCircle2, ShieldCheck, Eye, PlusCircle, BookmarkCheck, FileText, Image as ImageIcon, Video as VideoIcon, Paperclip } from 'lucide-react';
import { api } from '../api/client.js';

interface TemplateOption {
  id: string;
  name: string;
  category: string;
  language: string;
  header_type?: string;
  body: string;
  sampleVariables: string[];
}

interface SendNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNoticeSent: () => void;
}

export const SendNoticeModal: React.FC<SendNoticeModalProps> = ({
  isOpen,
  onClose,
  onNoticeSent
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingTemplateOnly, setSavingTemplateOnly] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Form State
  const [noticeTitle, setNoticeTitle] = useState('');
  const [recipientGroup, setRecipientGroup] = useState('STUDENT');
  const [department, setDepartment] = useState('ALL');

  // Dynamic Template State
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [isCustomTemplate, setIsCustomTemplate] = useState(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');

  // Custom Template inputs (direct match with Meta WhatsApp Manager)
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [customCategory, setCustomCategory] = useState('UTILITY');
  const [customLanguage, setCustomLanguage] = useState('en');
  const [customTemplateText, setCustomTemplateText] = useState('');

  // Template Header Media State (None, Image, Document, Video)
  const [headerType, setHeaderType] = useState<'NONE' | 'IMAGE' | 'DOCUMENT' | 'VIDEO'>('NONE');
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [headerDocFilename, setHeaderDocFilename] = useState('');

  // Dynamic Variable Values: e.g. { "1": "Elena", "2": "CS401" }
  const [variables, setVariables] = useState<Record<string, string>>({});

  // Real Counts from MySQL
  const [realCounts, setRealCounts] = useState<Record<string, number>>({
    STUDENT: 0,
    FACULTY: 0,
    STAFF: 0,
    ALUMNI: 0,
    CANDIDATE: 0,
    ALL: 0
  });

  // Dynamic Departments from MySQL
  const [availableDepartments, setAvailableDepartments] = useState<Array<{ id: string; code: string; name: string; contact_count?: number }>>([]);

  // Load real templates and real contact counts from MySQL whenever modal opens
  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.getTemplates();
      if (res.success && Array.isArray(res.templates) && res.templates.length > 0) {
        setTemplates(res.templates);
        // Default to first template if not yet set or if current not found
        if (!selectedTemplateName || !res.templates.some(t => t.name === selectedTemplateName)) {
          setSelectedTemplateName(res.templates[0].name);
          setIsCustomTemplate(false);
        }
      } else {
        setTemplates([]);
        setIsCustomTemplate(true);
      }
    } catch (err) {
      console.warn('Could not fetch templates from backend:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      api.getContacts().then(res => {
        if (res.success && res.breakdown) {
          setRealCounts({
            STUDENT: res.breakdown.students || 0,
            FACULTY: res.breakdown.faculty || 0,
            STAFF: res.breakdown.staff || 0,
            ALUMNI: res.breakdown.alumni || 0,
            CANDIDATE: res.breakdown.candidates || 0,
            ALL: res.total || 0
          });
        }
      });
      api.getDepartments().then(res => {
        if (res.success && Array.isArray(res.departments)) {
          setAvailableDepartments(res.departments);
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  // Determine active template and text
  const currentTemplate = templates.find(t => t.name === selectedTemplateName);
  const activeTemplateText = isCustomTemplate
    ? customTemplateText
    : (currentTemplate ? currentTemplate.body : '');

  // Extract all {{1}}, {{2}} positional or {{first_name}} named tags from active template text in order of appearance
  const detectedPlaceholders = Array.from(activeTemplateText.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g))
    .map(match => match[1])
    .filter((value, index, self) => self.indexOf(value) === index);

  // Initialize variable defaults whenever template changes
  useEffect(() => {
    const isNameField = (tag: string) =>
      tag === '1' || tag === 'name' || tag === 'first_name' || tag === 'student_name' || tag === 'recipient_name' || tag === 'candidate_name';
    const isIdField = (tag: string) =>
      tag === '2' || tag === 'id' || tag === 'app_id' || tag === 'application_id' || tag === 'roll' || tag === 'regno';

    if (!isCustomTemplate && currentTemplate) {
      const initial: Record<string, string> = {};
      detectedPlaceholders.forEach((tag, idx) => {
        if (isNameField(tag)) {
          initial[tag] = '[Auto: Recipient Full Name]';
        } else if (isIdField(tag)) {
          initial[tag] = '[Auto: Application ID / Roll No]';
        } else {
          initial[tag] = currentTemplate.sampleVariables[idx] || '';
        }
      });
      setVariables(initial);

      if (currentTemplate.header_type && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(currentTemplate.header_type.toUpperCase())) {
        setHeaderType(currentTemplate.header_type.toUpperCase() as any);
      } else {
        setHeaderType('NONE');
      }
    } else if (isCustomTemplate) {
      setVariables(prev => {
        const initial: Record<string, string> = { ...prev };
        detectedPlaceholders.forEach(tag => {
          if (!initial[tag]) {
            if (isNameField(tag)) {
              initial[tag] = '[Auto: Recipient Full Name]';
            } else if (isIdField(tag)) {
              initial[tag] = '[Auto: Application ID / Roll No]';
            } else {
              initial[tag] = '';
            }
          }
        });
        return initial;
      });
    }
  }, [selectedTemplateName, isCustomTemplate, customTemplateText]);

  const handleVariableChange = (placeholderNum: string, val: string) => {
    setVariables(prev => ({ ...prev, [placeholderNum]: val }));
  };

  // Generate live WhatsApp bubble preview
  const generatePreviewText = () => {
    if (!activeTemplateText) {
      return isCustomTemplate
        ? 'Type your template body text with {{1}}, {{2}} above to see live handset preview...'
        : 'Select a template to preview official WhatsApp message bubble...';
    }
    let preview = activeTemplateText;
    detectedPlaceholders.forEach(num => {
      let val = variables[num] || `{{${num}}}`;
      if (val.includes('[Auto: Recipient Full Name]') || val.includes('[Student Name]')) val = 'Neelam Arora';
      if (val.includes('[Auto: Application ID') || val.includes('Application ID') || val.includes('Roll No')) val = 'JMCHRC-APP/2026-000964';
      preview = preview.replace(new RegExp(`\\{\\{${num}\\}\\}`, 'g'), val);
    });
    return preview;
  };

  // Action: Save new template without immediately sending
  const handleSaveTemplateOnly = async () => {
    if (!customTemplateName.trim()) {
      alert('Please enter the Template Name as approved in your Meta Dashboard.');
      return;
    }
    if (!customTemplateText.trim()) {
      alert('Please enter the Template Text with {{1}}, {{2}} placeholders.');
      return;
    }

    setSavingTemplateOnly(true);
    setSaveSuccessMsg('');
    try {
      const cleanName = customTemplateName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const res = await api.saveTemplate({
        name: cleanName,
        category: customCategory,
        language: customLanguage,
        header_type: headerType,
        body: customTemplateText.trim(),
        sample_variables: detectedPlaceholders.map(p => variables[p] || `Sample {{${p}}}`)
      });

      if (res.success) {
        setSaveSuccessMsg(`Template '${cleanName}' successfully saved!`);
        await fetchTemplates();
        setSelectedTemplateName(cleanName);
        setIsCustomTemplate(false);
      } else {
        alert('Could not save template: ' + (res.message || 'Database error'));
      }
    } catch (err) {
      alert('Error connecting to backend database');
    } finally {
      setSavingTemplateOnly(false);
    }
  };

  // Action: Send Notice (and auto-save template to MySQL list if custom)
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const activeName = isCustomTemplate
        ? customTemplateName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
        : selectedTemplateName;

      if (!activeName) {
        alert('Please enter or select a template name.');
        setIsSubmitting(false);
        return;
      }

      // If custom template, persist it first so it appears in the dropdown list forever
      if (isCustomTemplate) {
        await api.saveTemplate({
          name: activeName,
          category: customCategory,
          language: customLanguage,
          header_type: headerType,
          body: customTemplateText.trim(),
          sample_variables: detectedPlaceholders.map(p => variables[p] || `Sample {{${p}}}`)
        });
      }

      await api.launchCampaign({
        name: noticeTitle.trim() || `Official Notice: ${activeName}`,
        template_id: isCustomTemplate ? `TPL-${activeName.toUpperCase()}` : (currentTemplate?.id || 'TPL-CURRENT'),
        audience: {
          category: recipientGroup,
          department,
          academic_year: '2026'
        },
        schedule_type: 'IMMEDIATE',
        variables: {
          ...variables,
          meta_template_name: activeName,
          ...(headerType !== 'NONE' && headerMediaUrl.trim() ? (() => {
            let directUrl = headerMediaUrl.trim();
            if (directUrl.includes('drive.google.com')) {
              const match = directUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || directUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
              if (match) {
                directUrl = `https://drive.usercontent.google.com/download?id=${match[1]}&export=download`;
              }
            }
            return {
              _header_media_url: directUrl,
              _header_media_type: headerType.toLowerCase(),
              _header_media_filename: headerDocFilename.trim() || (headerType === 'DOCUMENT' ? 'Important_Instructions.pdf' : undefined)
            };
          })() : {})
        }
      });

      // Refresh templates in state so the user sees their new template immediately next time
      await fetchTemplates();
      onNoticeSent();
      onClose();
    } catch (err) {
      alert('Failed to send notice. Please check server connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRecipientLabel = (group: string) => {
    const count = realCounts[group] ?? 0;
    switch (group) {
      case 'STUDENT': return `${count} registered student${count !== 1 ? 's' : ''}`;
      case 'FACULTY': return `${count} faculty member${count !== 1 ? 's' : ''}`;
      case 'STAFF': return `${count} administrative staff member${count !== 1 ? 's' : ''}`;
      case 'ALUMNI': return `${count} verified graduate${count !== 1 ? 's' : ''}`;
      case 'CANDIDATE': return `${count} interview candidate${count !== 1 ? 's' : ''}`;
      default: return `${count} total university contact${count !== 1 ? 's' : ''}`;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: '880px', width: '95%' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--uni-black)', fontWeight: 700 }}>
              Send Official WhatsApp Notice
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--uni-muted)' }}>
              Dispatched directly to students and faculty using approved Meta WhatsApp Templates
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--uni-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSend}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr', gap: '24px' }}>
            {/* Left Column: Form Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 1. Subject */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Notice Subject / Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  placeholder="e.g. Official University Notice or Greetings"
                  required
                />
              </div>

              {/* 2. Recipient Targeting */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Recipient Group</label>
                  <select
                    className="form-select"
                    value={recipientGroup}
                    onChange={(e) => setRecipientGroup(e.target.value)}
                  >
                    <option value="STUDENT">Students</option>
                    <option value="FACULTY">Teachers / Faculty</option>
                    <option value="CANDIDATE">Interview Candidates / Applicants</option>
                    <option value="STAFF">Administrative Staff</option>
                    <option value="ALUMNI">Alumni</option>
                    <option value="ALL">Entire University</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Department Scope</label>
                  <select
                    className="form-select"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="ALL">All Departments (Entire University)</option>
                    {availableDepartments.map(d => (
                      <option key={d.id} value={d.code || d.name}>
                        {d.name} {d.contact_count ? `(${d.contact_count.toLocaleString()})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Count Indicator */}
              <div style={{
                fontSize: '0.78rem',
                color: '#2E7D32',
                backgroundColor: '#E8F5E9',
                padding: '6px 12px',
                borderRadius: 'var(--radius-subtle)',
                fontWeight: 500
              }}>
                ✓ Targeting <strong>{getRecipientLabel(recipientGroup)}</strong>
                {realCounts[recipientGroup] === 0 && (
                  <span style={{ color: '#1B5E20', marginLeft: '6px' }}>
                    (Test recipient active)
                  </span>
                )}
              </div>

              {/* 3. Meta Template Selection & Addition */}
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    WhatsApp Template (Meta Dashboard)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomTemplate(!isCustomTemplate);
                      setSaveSuccessMsg('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--uni-red)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {isCustomTemplate ? '← Pick from saved templates' : '+ Enter new template from Meta'}
                  </button>
                </div>

                {saveSuccessMsg && (
                  <div style={{
                    padding: '6px 10px',
                    backgroundColor: '#E8F5E9',
                    color: '#2E7D32',
                    borderRadius: 'var(--radius-subtle)',
                    fontSize: '0.75rem',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <BookmarkCheck size={14} />
                    <span>{saveSuccessMsg}</span>
                  </div>
                )}

                {isCustomTemplate ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    padding: '14px',
                    backgroundColor: '#FAFAFA',
                    border: '1px solid var(--uni-border-gray)',
                    borderRadius: 'var(--radius-subtle)'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--uni-black)', display: 'block', marginBottom: '4px' }}>
                          Template Name (Exact match from Meta)
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. ganesh_chaturthi or admissions_round2"
                          value={customTemplateName}
                          onChange={(e) => setCustomTemplateName(e.target.value)}
                          required
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--uni-black)', display: 'block', marginBottom: '4px' }}>
                            Category
                          </label>
                          <select
                            className="form-select"
                            value={customCategory}
                            onChange={(e) => setCustomCategory(e.target.value)}
                          >
                            <option value="UTILITY">UTILITY</option>
                            <option value="MARKETING">MARKETING</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--uni-black)', display: 'block', marginBottom: '4px' }}>
                            Language
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={customLanguage}
                            onChange={(e) => setCustomLanguage(e.target.value)}
                            placeholder="en"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--uni-black)', display: 'block', marginBottom: '4px' }}>
                        Template Body (Paste from Meta with &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125;)
                      </label>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        placeholder="e.g. Warm greetings on Ganesh Chaturthi, {{1}}! May Lord Ganesha bring joy to you and your family."
                        value={customTemplateText}
                        onChange={(e) => setCustomTemplateText(e.target.value)}
                        style={{ fontSize: '0.8rem' }}
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--uni-muted)' }}>
                        ✨ Automatically saved to your reusable template list upon send.
                      </span>
                      <button
                        type="button"
                        onClick={handleSaveTemplateOnly}
                        disabled={savingTemplateOnly}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                      >
                        <BookmarkCheck size={13} />
                        <span>{savingTemplateOnly ? 'Saving...' : 'Save to List Now'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {templates.length === 0 ? (
                      <div style={{
                        padding: '12px',
                        backgroundColor: '#FAFAFA',
                        border: '1px dashed var(--uni-border-gray)',
                        borderRadius: 'var(--radius-subtle)',
                        fontSize: '0.8125rem',
                        textAlign: 'center'
                      }}>
                        <span style={{ color: 'var(--uni-muted)' }}>No saved templates yet. </span>
                        <button
                          type="button"
                          onClick={() => setIsCustomTemplate(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--uni-red)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          + Enter your Meta template name
                        </button>
                      </div>
                    ) : (
                      <select
                        className="form-select"
                        value={selectedTemplateName}
                        onChange={(e) => setSelectedTemplateName(e.target.value)}
                      >
                        {templates.map(t => (
                          <option key={t.id} value={t.name}>
                            {t.name} ({t.category})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* 3.5 TEMPLATE HEADER MEDIA (Image, PDF Document, Video) */}
              <div style={{
                border: '1px solid var(--uni-border-gray)',
                borderRadius: 'var(--radius-subtle)',
                padding: '12px',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--uni-black)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Paperclip size={14} color="var(--uni-red)" />
                    <span>Template Header Media</span>
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['NONE', 'IMAGE', 'DOCUMENT', 'VIDEO'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setHeaderType(type)}
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          borderRadius: '4px',
                          border: '1px solid ' + (headerType === type ? 'var(--uni-red)' : '#D1D5DB'),
                          backgroundColor: headerType === type ? '#FEE2E2' : '#FFFFFF',
                          color: headerType === type ? 'var(--uni-red)' : '#4B5563',
                          cursor: 'pointer'
                        }}
                      >
                        {type === 'NONE' ? 'Text Only' : type}
                      </button>
                    ))}
                  </div>
                </div>

                {headerType !== 'NONE' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--uni-black)', display: 'block', marginBottom: '3px' }}>
                        {headerType === 'IMAGE' && 'Public Image URL (JPG/PNG, max 5MB)'}
                        {headerType === 'DOCUMENT' && 'Public Document URL (PDF/DOCX, max 100MB)'}
                        {headerType === 'VIDEO' && 'Public Video URL (MP4, max 16MB)'}
                      </label>
                      <input
                        type="url"
                        className="form-input"
                        placeholder={
                          headerType === 'IMAGE' ? 'https://jecrcuniversity.edu.in/banners/fest.jpg' :
                          headerType === 'DOCUMENT' ? 'https://jecrcuniversity.edu.in/circulars/exam_schedule.pdf' :
                          'https://jecrcuniversity.edu.in/videos/campus_tour.mp4'
                        }
                        value={headerMediaUrl}
                        onChange={(e) => setHeaderMediaUrl(e.target.value)}
                        style={{ fontSize: '0.8rem' }}
                      />
                    </div>

                    {headerType === 'DOCUMENT' && (
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--uni-black)', display: 'block', marginBottom: '3px' }}>
                          Attachment Display Filename (shown on recipient phone)
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. End_Term_Examination_Schedule_2026.pdf"
                          value={headerDocFilename}
                          onChange={(e) => setHeaderDocFilename(e.target.value)}
                          style={{ fontSize: '0.8rem' }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 4. DYNAMIC VARIABLES SECTION */}
              <div style={{
                border: '1px solid var(--uni-border-gray)',
                borderRadius: 'var(--radius-subtle)',
                padding: '14px',
                backgroundColor: 'var(--uni-light-gray)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                    Template Variables Detected ({detectedPlaceholders.length})
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--uni-muted)' }}>
                    Meta placeholders ({detectedPlaceholders.map(p => `{{${p}}}`).join(', ') || 'None'})
                  </span>
                </div>

                {detectedPlaceholders.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--uni-muted)', padding: '8px 0' }}>
                    This Meta template has no variable placeholders. The exact text will be sent to all recipients.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {detectedPlaceholders.map(num => (
                      <div key={num}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--uni-black)' }}>
                            Placeholder &#123;&#123;{num}&#125;&#125;
                          </label>
                          {(num === '1' || num === 'name' || num === 'first_name' || num === 'student_name' || num === 'candidate_name') && (
                            <span style={{ fontSize: '0.7rem', color: '#2E7D32', fontWeight: 500 }}>
                              Auto-populates recipient name from candidate/student registry
                            </span>
                          )}
                          {(num === '2' || num === 'id' || num === 'app_id' || num === 'application_id' || num === 'roll' || num === 'regno') && (
                            <span style={{ fontSize: '0.7rem', color: '#2E7D32', fontWeight: 500 }}>
                              Auto-populates candidate Application ID (e.g. JMCHRC-APP/...) from Excel
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          className="form-input"
                          value={variables[num] || ''}
                          onChange={(e) => handleVariableChange(num, e.target.value)}
                          placeholder={`Enter value for {{${num}}}...`}
                          style={{ fontSize: '0.8125rem' }}
                          required
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Live WhatsApp Handset Preview */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--uni-black)' }}>
                <Eye size={15} color="var(--uni-red)" />
                <span>Live WhatsApp Recipient Preview</span>
              </div>

              <div style={{
                backgroundColor: '#ECE5DD', // Official WhatsApp chat background
                borderRadius: '8px',
                border: '1px solid #D1D7DB',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                flex: 1,
                minHeight: '280px'
              }}>
                {/* Chat Bubble */}
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '7.5px',
                  boxShadow: '0 1px 1px rgba(0,0,0,0.13)',
                  padding: '12px 14px',
                  position: 'relative',
                  maxWidth: '92%',
                  fontSize: '0.84rem',
                  lineHeight: 1.45,
                  color: '#111B21'
                }}>
                  <div style={{ fontWeight: 600, fontSize: '0.75rem', color: '#128C7E', marginBottom: '4px' }}>
                    University Official Communication
                  </div>

                  {/* Header Media Rendering inside Bubble */}
                  {headerType === 'IMAGE' && (
                    <div style={{
                      borderRadius: '6px',
                      overflow: 'hidden',
                      marginBottom: '8px',
                      backgroundColor: '#E5E7EB',
                      maxHeight: '160px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {headerMediaUrl ? (
                        <img
                          src={headerMediaUrl}
                          alt="WhatsApp Header Media"
                          style={{ width: '100%', maxHeight: '160px', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: '#6B7280', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <ImageIcon size={28} color="#9CA3AF" />
                          <span>[Header Image Banner]</span>
                        </div>
                      )}
                    </div>
                  )}

                  {headerType === 'DOCUMENT' && (
                    <div style={{
                      borderRadius: '6px',
                      backgroundColor: '#F3F4F6',
                      border: '1px solid #E5E7EB',
                      padding: '10px 12px',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '6px',
                        backgroundColor: '#EF4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF'
                      }}>
                        <FileText size={20} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1F2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {headerDocFilename || 'University_Official_Notice.pdf'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#6B7280' }}>
                          PDF Document • Official Circular
                        </div>
                      </div>
                    </div>
                  )}

                  {headerType === 'VIDEO' && (
                    <div style={{
                      borderRadius: '6px',
                      backgroundColor: '#1F2937',
                      color: '#FFFFFF',
                      padding: '24px 0',
                      marginBottom: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}>
                      <VideoIcon size={28} color="#F87171" />
                      <span style={{ fontSize: '0.75rem' }}>[Header Video Clip]</span>
                    </div>
                  )}

                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {generatePreviewText()}
                  </div>
                  <div style={{
                    fontSize: '0.65rem',
                    color: '#667781',
                    textAlign: 'right',
                    marginTop: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '4px'
                  }}>
                    <span>10:00 AM</span>
                    <span style={{ color: '#53BDEB' }}>✓✓</span>
                  </div>
                </div>

                {/* Meta Workflow Explainer */}
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  fontSize: '0.74rem',
                  color: 'var(--uni-muted)',
                  border: '1px solid #E0E0E0',
                  marginTop: '16px'
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--uni-black)', marginBottom: '2px' }}>
                    Direct Meta Template Workflow:
                  </div>
                  1. Create and approve your template on Meta WhatsApp Manager.<br />
                  2. Enter the template name and text here.<br />
                  3. After dispatch, it is permanently saved in your list for easy 1-click reuse.
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ padding: '8px 24px' }}>
              <Send size={15} />
              <span>{isSubmitting ? 'Submitting to Queue...' : 'Send Notice Now'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
