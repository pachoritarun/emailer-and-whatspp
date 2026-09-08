import React, { useEffect, useState } from 'react';
import { api, API_BASE } from '../api/client.js';
import { ContactItem } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import {
  UploadCloud,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  FileText
} from 'lucide-react';

export const ContactsView: React.FC = () => {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [total, setTotal] = useState(0);
  const [breakdown, setBreakdown] = useState<Record<string, number>>({
    students: 0,
    faculty: 0,
    staff: 0,
    alumni: 0
  });

  // Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [defaultCategory, setDefaultCategory] = useState('STUDENT');
  const [defaultDepartment, setDefaultDepartment] = useState('DEP-CS');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const loadContacts = () => {
    api.getContacts().then(res => {
      if (res.success) {
        setContacts(res.contacts);
        setTotal(res.total);
        if (res.breakdown) setBreakdown(res.breakdown);
      }
    });
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setImportResult(null);
    }
  };

  const handleDownloadTemplate = () => {
    window.open(`${API_BASE}/contacts/template`, '_blank');
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select an Excel or CSV file first.');
      return;
    }

    setImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

        const res = await api.uploadContactsExcel({
          file_base64: base64,
          filename: selectedFile.name,
          default_category: defaultCategory,
          default_department: defaultDepartment
        });

        if (res.success) {
          setImportResult(res);
          loadContacts();
        } else {
          alert('Import failed: ' + (res.error || 'Unknown error parsing file'));
        }
      } catch (err: any) {
        alert('Failed uploading file to server: ' + err.message);
      } finally {
        setImporting(false);
      }
    };
    reader.onerror = () => {
      alert('Failed reading selected file from disk');
      setImporting(false);
    };
    reader.readAsDataURL(selectedFile);
  };

  return (
    <div>
      {/* Category Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div className="uni-card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--uni-black)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--uni-muted)', textTransform: 'uppercase' }}>
            Registered Students
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--uni-black)', margin: '4px 0' }}>
            {breakdown.students.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--uni-muted)' }}>Category: STUDENT</div>
        </div>

        <div className="uni-card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--uni-black)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--uni-muted)', textTransform: 'uppercase' }}>
            Teachers & Faculty
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--uni-black)', margin: '4px 0' }}>
            {breakdown.faculty.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--uni-muted)' }}>Category: FACULTY</div>
        </div>

        <div className="uni-card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--uni-black)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--uni-muted)', textTransform: 'uppercase' }}>
            Administrative Staff
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--uni-black)', margin: '4px 0' }}>
            {breakdown.staff.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--uni-muted)' }}>Category: STAFF</div>
        </div>

        <div className="uni-card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--uni-black)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--uni-muted)', textTransform: 'uppercase' }}>
            Graduated Alumni
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--uni-black)', margin: '4px 0' }}>
            {breakdown.alumni.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--uni-muted)' }}>Category: ALUMNI</div>
        </div>
      </div>

      {/* Admin Action Bar */}
      <div style={{
        padding: '14px 20px',
        backgroundColor: 'var(--uni-white)',
        border: '1px solid var(--uni-border-gray)',
        borderRadius: 'var(--radius-subtle)',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2E7D32' }}></span>
          <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
            Mandatory Institutional Privacy Policy: Phone numbers are encrypted with AES-256 in MySQL and are NEVER exposed in UI tables or logs.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleDownloadTemplate}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Download formatted Excel sheet template"
          >
            <Download size={14} />
            <span>Sample Excel Template</span>
          </button>

          <button
            onClick={() => {
              setSelectedFile(null);
              setImportResult(null);
              setIsImportModalOpen(true);
            }}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <UploadCloud size={15} />
            <span>+ Upload Excel / CSV Registry</span>
          </button>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="uni-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--uni-black)' }}>
              University Verified Contact Registry
            </h2>
            <div className="text-muted" style={{ fontSize: '0.8125rem' }}>
              Showing verified active institutional recipients ({total.toLocaleString()} total stored in MySQL database)
            </div>
          </div>
        </div>

        <div className="table-container">
          <table className="uni-table">
            <thead>
              <tr>
                <th>Institutional ID / Roll No</th>
                <th>Full Name</th>
                <th>Target Category</th>
                <th>Department</th>
                <th>WhatsApp Consent</th>
                <th>Date Added</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--uni-muted)' }}>
                    <Users size={36} color="var(--uni-muted)" style={{ margin: '0 auto 10px' }} />
                    <div style={{ fontWeight: 700, color: 'var(--uni-black)', fontSize: '0.95rem', marginBottom: '4px' }}>
                      No Contacts Enrolled Yet
                    </div>
                    <div style={{ fontSize: '0.8125rem', maxWidth: '440px', margin: '0 auto 16px' }}>
                      Upload an Excel or CSV sheet with student or teacher mobile numbers to populate the database and target them in notice broadcasts.
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                      <button onClick={handleDownloadTemplate} className="btn btn-secondary btn-sm">
                        <Download size={14} />
                        <span>Download Sample Format (.xlsx)</span>
                      </button>
                      <button onClick={() => setIsImportModalOpen(true)} className="btn btn-primary btn-sm">
                        <UploadCloud size={14} />
                        <span>Upload Excel Sheet</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                contacts.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.8rem' }}>
                      {c.external_id}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {c.name}
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        backgroundColor: 'var(--uni-light-gray)',
                        padding: '2px 8px',
                        borderRadius: '2px',
                        color: 'var(--uni-black)'
                      }}>
                        {c.category}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      {c.department}
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--uni-muted)' }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real Excel Import Modal */}
      {isImportModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '620px', width: '95%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--uni-black)' }}>
                  Upload Excel Sheet & Store Phone Numbers
                </h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--uni-muted)' }}>
                  Numbers are tokenized, AES-256 encrypted, and stored in MySQL. Zero plain numbers exposed.
                </div>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="var(--uni-muted)" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* File Upload Zone */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    Select Excel or CSV Spreadsheet (.xlsx, .xls, .csv)
                  </label>
                  <div style={{
                    border: '2px dashed var(--uni-border-gray)',
                    borderRadius: 'var(--radius-subtle)',
                    padding: '20px',
                    textAlign: 'center',
                    backgroundColor: '#FAFAFA'
                  }}>
                    <FileSpreadsheet size={32} color="var(--uni-muted)" style={{ margin: '0 auto 8px' }} />
                    <input
                      type="file"
                      id="excel-file-input"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                      required
                    />
                    <label
                      htmlFor="excel-file-input"
                      className="btn btn-secondary btn-sm"
                      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <UploadCloud size={14} />
                      <span>{selectedFile ? 'Change File' : 'Browse Excel File'}</span>
                    </label>

                    {selectedFile ? (
                      <div style={{ marginTop: '10px', fontSize: '0.8125rem', fontWeight: 600, color: '#1B5E20' }}>
                        ✓ Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </div>
                    ) : (
                      <div style={{ marginTop: '6px', fontSize: '0.74rem', color: 'var(--uni-muted)' }}>
                        Supports .xlsx, .xls, and .csv files with student or faculty numbers
                      </div>
                    )}
                  </div>
                </div>

                {/* Category & Department Selection */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Target Recipient Category</label>
                    <select
                      className="form-select"
                      value={defaultCategory}
                      onChange={(e) => setDefaultCategory(e.target.value)}
                    >
                      <option value="STUDENT">Enrolled Students (STUDENT)</option>
                      <option value="FACULTY">Teachers & Faculty (FACULTY)</option>
                      <option value="STAFF">Administrative Staff (STAFF)</option>
                      <option value="ALUMNI">Graduated Alumni (ALUMNI)</option>
                    </select>
                    <div style={{ fontSize: '0.7rem', color: 'var(--uni-muted)', marginTop: '3px' }}>
                      Default category assigned if not specified per row in sheet
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Department / Branch</label>
                    <select
                      className="form-select"
                      value={defaultDepartment}
                      onChange={(e) => setDefaultDepartment(e.target.value)}
                    >
                      <option value="DEP-CS">Computer Science & Eng</option>
                      <option value="DEP-MED">School of Medicine</option>
                      <option value="DEP-LAW">Faculty of Law</option>
                      <option value="DEP-BUS">Business Administration</option>
                      <option value="DEP-REG">General / Registrar</option>
                    </select>
                    <div style={{ fontSize: '0.7rem', color: 'var(--uni-muted)', marginTop: '3px' }}>
                      Department scope for filtering
                    </div>
                  </div>
                </div>

                {/* Expected Column Format Helper */}
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--uni-light-gray)',
                  border: '1px solid var(--uni-border-gray)',
                  borderRadius: 'var(--radius-subtle)',
                  fontSize: '0.78rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--uni-black)' }}>Expected Column Headers:</span>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      style={{ background: 'none', border: 'none', color: 'var(--uni-red)', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
                    >
                      Download Template (.xlsx)
                    </button>
                  </div>
                  <div style={{ color: 'var(--uni-muted)', lineHeight: 1.4 }}>
                    Columns detected automatically: <strong>Full Name</strong>, <strong>Mobile Number</strong> (e.g. 919309313044), <strong>Roll Number</strong> (optional), and <strong>Category</strong> (optional).
                  </div>
                </div>

                {/* Success Result Callout */}
                {importResult && (
                  <div style={{
                    padding: '14px',
                    backgroundColor: '#E8F5E9',
                    border: '1px solid #C8E6C9',
                    borderRadius: 'var(--radius-subtle)',
                    color: '#1B5E20',
                    fontSize: '0.8125rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '6px' }}>
                      <CheckCircle2 size={16} />
                      <span>Excel Registry Successfully Ingested into MySQL!</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '6px' }}>
                      <div>Rows Detected: <strong>{importResult.rows_detected}</strong></div>
                      <div>Rows Imported: <strong>{importResult.rows_imported}</strong></div>
                      <div>Rejected: <strong>{importResult.rows_rejected}</strong></div>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#2E7D32', marginTop: '6px' }}>
                      Audit Tracking Code: <code>{importResult.import_code}</code>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="btn btn-secondary"
                >
                  {importResult ? 'Close' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={importing || !selectedFile}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <UploadCloud size={15} />
                  <span>{importing ? 'Encrypting & Storing in MySQL...' : 'Upload & Store in MySQL'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
