import React, { useState } from 'react';
import { X, Check, ArrowRight, ArrowLeft, Send, Users, FileText, Calendar, CheckCircle2 } from 'lucide-react';
import { api } from '../../api/client.js';

interface CampaignWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCampaignCreated: () => void;
}

export const CampaignWizardModal: React.FC<CampaignWizardModalProps> = ({
  isOpen,
  onClose,
  onCampaignCreated
}) => {
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [campaignName, setCampaignName] = useState('Fall 2026 Emergency Registration Notice');
  const [targetCategory, setTargetCategory] = useState('STUDENT');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedTemplate, setSelectedTemplate] = useState('TPL-EXAM-REM');
  const [scheduleType, setScheduleType] = useState<'IMMEDIATE' | 'SCHEDULED'>('IMMEDIATE');
  const [scheduledAt, setScheduledAt] = useState('2026-09-10T09:00');
  const [varNoticeType, setVarNoticeType] = useState('Final Semester Examination');
  const [varVenue, setVarVenue] = useState('Main Campus Hall B');

  if (!isOpen) return null;

  const steps = [
    { num: 1, title: 'Audience' },
    { num: 2, title: 'Template' },
    { num: 3, title: 'Variables' },
    { num: 4, title: 'Schedule' },
    { num: 5, title: 'Review' }
  ];

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleLaunch = async () => {
    setIsSubmitting(true);
    try {
      await api.launchCampaign({
        name: campaignName,
        template_id: selectedTemplate,
        audience: {
          category: targetCategory,
          department: selectedDept,
          academic_year: '2026'
        },
        schedule_type: scheduleType,
        scheduled_at: scheduleType === 'SCHEDULED' ? scheduledAt : undefined,
        variables: {
          notice_type: varNoticeType,
          venue: varVenue
        }
      });
      onCampaignCreated();
      onClose();
    } catch (err) {
      alert('Failed launching campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        {/* Header */}
        <div className="modal-header">
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--uni-muted)', textTransform: 'uppercase' }}>
              Institutional Communication Dispatch
            </div>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--uni-black)' }}>
              Campaign Creation Wizard
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--uni-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div style={{ padding: '16px 24px 0' }}>
          <div className="wizard-stepper">
            {steps.map((s, idx) => {
              const isActive = step === s.num;
              const isCompleted = step > s.num;
              return (
                <React.Fragment key={s.num}>
                  <div className={`wizard-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                    <div className="step-number">
                      {isCompleted ? <Check size={14} /> : s.num}
                    </div>
                    <span>{s.title}</span>
                  </div>
                  {idx < steps.length - 1 && <div className="step-divider" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Body Steps */}
        <div className="modal-body">
          {/* Step 1: Audience */}
          {step === 1 && (
            <div>
              <div className="form-group">
                <label className="form-label">Campaign Official Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Fall 2026 Examination Notice"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Audience Category</label>
                <select
                  className="form-select"
                  value={targetCategory}
                  onChange={(e) => setTargetCategory(e.target.value)}
                >
                  <option value="STUDENT">Enrolled Students (55,000 eligible)</option>
                  <option value="FACULTY">Academic Faculty (8,000 eligible)</option>
                  <option value="STAFF">Administrative Staff (4,200 eligible)</option>
                  <option value="ALUMNI">Graduated Alumni (12,000 eligible)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Departmental Scope</label>
                <select
                  className="form-select"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  <option value="ALL">All Departments (University-wide)</option>
                  <option value="CS">Computer Science & Engineering</option>
                  <option value="MED">Medicine & Health Sciences</option>
                  <option value="LAW">Faculty of Law</option>
                  <option value="BUS">Business Administration</option>
                </select>
              </div>

              <div style={{
                padding: '12px 16px',
                backgroundColor: 'var(--uni-light-gray)',
                border: '1px solid var(--uni-border-gray)',
                borderRadius: 'var(--radius-subtle)',
                fontSize: '0.8125rem'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '2px' }}>Regulatory Compliance Guarantee:</div>
                <div style={{ color: 'var(--uni-muted)' }}>
                  All recipients are filtered against the university's opt-in consent registry. Zero phone numbers are exposed to operators.
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Template */}
          {step === 2 && (
            <div>
              <div className="form-group">
                <label className="form-label">Approved WhatsApp Meta Message Template</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '14px',
                    border: selectedTemplate === 'TPL-EXAM-REM' ? '1px solid var(--uni-red)' : '1px solid var(--uni-border-gray)',
                    borderRadius: 'var(--radius-subtle)',
                    cursor: 'pointer',
                    backgroundColor: selectedTemplate === 'TPL-EXAM-REM' ? '#FFFBFB' : 'var(--uni-white)'
                  }}>
                    <input
                      type="radio"
                      name="tpl"
                      checked={selectedTemplate === 'TPL-EXAM-REM'}
                      onChange={() => setSelectedTemplate('TPL-EXAM-REM')}
                      style={{ marginTop: '4px' }}
                    />
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>semester_exam_schedule_v2 (UTILITY)</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--uni-muted)', marginTop: '4px' }}>
                        "Official University Notice: Dear &#123;&#123;1&#125;&#125;, your semester examination for &#123;&#123;2&#125;&#125; is scheduled on &#123;&#123;3&#125;&#125; at Hall &#123;&#123;4&#125;&#125;."
                      </div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '14px',
                    border: selectedTemplate === 'TPL-TUITION-DUE' ? '1px solid var(--uni-red)' : '1px solid var(--uni-border-gray)',
                    borderRadius: 'var(--radius-subtle)',
                    cursor: 'pointer',
                    backgroundColor: selectedTemplate === 'TPL-TUITION-DUE' ? '#FFFBFB' : 'var(--uni-white)'
                  }}>
                    <input
                      type="radio"
                      name="tpl"
                      checked={selectedTemplate === 'TPL-TUITION-DUE'}
                      onChange={() => setSelectedTemplate('TPL-TUITION-DUE')}
                      style={{ marginTop: '4px' }}
                    />
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>tuition_fee_reminder_2026 (UTILITY)</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--uni-muted)', marginTop: '4px' }}>
                        "Bursar Notification: Dear &#123;&#123;1&#125;&#125;, the tuition fee deadline for the upcoming academic semester is &#123;&#123;2&#125;&#125;."
                      </div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '14px',
                    border: selectedTemplate === 'TPL-EMERGENCY' ? '1px solid var(--uni-red)' : '1px solid var(--uni-border-gray)',
                    borderRadius: 'var(--radius-subtle)',
                    cursor: 'pointer',
                    backgroundColor: selectedTemplate === 'TPL-EMERGENCY' ? '#FFFBFB' : 'var(--uni-white)'
                  }}>
                    <input
                      type="radio"
                      name="tpl"
                      checked={selectedTemplate === 'TPL-EMERGENCY'}
                      onChange={() => setSelectedTemplate('TPL-EMERGENCY')}
                      style={{ marginTop: '4px' }}
                    />
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>campus_safety_alert_urgent (UTILITY)</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--uni-muted)', marginTop: '4px' }}>
                        "CRITICAL CAMPUS ALERT: &#123;&#123;1&#125;&#125;. All faculty, students, and staff at &#123;&#123;2&#125;&#125; must follow emergency protocols."
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Variables */}
          {step === 3 && (
            <div>
              <div className="form-group">
                <label className="form-label">Template Variable 1 (Recipient Name)</label>
                <input
                  type="text"
                  className="form-input"
                  value="[Auto-resolved from Student Registry]"
                  disabled
                  style={{ backgroundColor: 'var(--uni-light-gray)' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Template Variable 2 (Notice / Course Description)</label>
                <input
                  type="text"
                  className="form-input"
                  value={varNoticeType}
                  onChange={(e) => setVarNoticeType(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Template Variable 3 (Exam Venue / Location Hall)</label>
                <input
                  type="text"
                  className="form-input"
                  value={varVenue}
                  onChange={(e) => setVarVenue(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 4: Schedule */}
          {step === 4 && (
            <div>
              <div className="form-group">
                <label className="form-label">Dispatch Timing</label>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="sch"
                      checked={scheduleType === 'IMMEDIATE'}
                      onChange={() => setScheduleType('IMMEDIATE')}
                    />
                    <span style={{ fontWeight: '500' }}>Immediate Launch</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="sch"
                      checked={scheduleType === 'SCHEDULED'}
                      onChange={() => setScheduleType('SCHEDULED')}
                    />
                    <span style={{ fontWeight: '500' }}>Schedule for Later</span>
                  </label>
                </div>

                {scheduleType === 'SCHEDULED' && (
                  <div>
                    <label className="form-label">Execution Date & Time</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Review & Snapshot */}
          {step === 5 && (
            <div>
              <div style={{
                border: '1px solid var(--uni-border-gray)',
                borderRadius: 'var(--radius-subtle)',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '12px 16px', backgroundColor: 'var(--uni-light-gray)', borderBottom: '1px solid var(--uni-border-gray)', fontWeight: '600' }}>
                  Immutable Campaign Launch Snapshot
                </div>
                <div style={{ padding: '16px', fontSize: '0.84rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Campaign Name:</span>
                    <strong>{campaignName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Audience Segment:</span>
                    <span>{targetCategory} ({selectedDept})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Estimated Target:</span>
                    <span>55,000 enrolled contacts</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Template Selected:</span>
                    <span>{selectedTemplate}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Dispatch Schedule:</span>
                    <span>{scheduleType === 'IMMEDIATE' ? 'Immediate Enqueueing' : scheduledAt}</span>
                  </div>
                </div>
              </div>

              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                backgroundColor: '#FFF8E1',
                border: '1px solid #FFE082',
                borderRadius: 'var(--radius-subtle)',
                fontSize: '0.78rem',
                color: '#795548'
              }}>
                <strong>Forensic Integrity Note:</strong> Clicking "Authorize & Launch" locks this configuration into an immutable snapshot and dispatches atomic jobs to the MySQL 8 durable message queue.
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          {step > 1 && (
            <button onClick={handleBack} className="btn btn-secondary">
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
          )}

          {step < 5 ? (
            <button onClick={handleNext} className="btn btn-primary">
              <span>Continue</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleLaunch}
              disabled={isSubmitting}
              className="btn btn-primary"
            >
              <Send size={16} />
              <span>{isSubmitting ? 'Authorizing Dispatch...' : 'Authorize & Launch Campaign'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
