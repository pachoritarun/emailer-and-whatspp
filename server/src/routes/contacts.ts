import { Router } from 'express';
import crypto from 'crypto';
import * as XLSX from 'xlsx';
import { getMemoryStore, commitStoreMutation, executeQuery } from '../db/pool.js';
import { AuditService } from '../services/audit.js';
import { cleanPhoneNumber, hashPhone, encryptPhone } from '../services/crypto.js';
import { logger } from '../services/logger.js';

export const contactsRouter = Router();

// GET /api/contacts - Real Sanitized contact directory from MySQL (NO phone numbers exposed)
contactsRouter.get('/', async (req, res) => {
  try {
    const rawContacts = await executeQuery(`
      SELECT 
        c.id, 
        c.external_identifier as external_id, 
        TRIM(CONCAT(c.first_name, ' ', COALESCE(c.last_name, ''))) as name, 
        cat.name as category, 
        COALESCE(d.name, 'General Department') as department, 
        'OPTED_IN' as status, 
        c.created_at
      FROM contacts c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN departments d ON c.department_id = d.id
      ORDER BY c.created_at DESC
      LIMIT 200
    `);

    const rawCounts = await executeQuery(`
      SELECT cat.code, COUNT(c.id) as count
      FROM categories cat
      LEFT JOIN contacts c ON cat.id = c.category_id
      GROUP BY cat.id
    `);

    const breakdown: Record<string, number> = {
      students: 0,
      faculty: 0,
      staff: 0,
      alumni: 0,
      candidates: 0
    };

    let total = 0;
    if (Array.isArray(rawCounts)) {
      rawCounts.forEach((r: any) => {
        const cnt = Number(r.count) || 0;
        total += cnt;
        if (r.code === 'STUDENT') breakdown.students = cnt;
        if (r.code === 'FACULTY') breakdown.faculty = cnt;
        if (r.code === 'STAFF') breakdown.staff = cnt;
        if (r.code === 'ALUMNI') breakdown.alumni = cnt;
        if (r.code === 'CANDIDATE') breakdown.candidates = cnt;
      });
    }

    res.json({
      success: true,
      total,
      breakdown,
      contacts: Array.isArray(rawContacts) ? rawContacts : []
    });
  } catch (err: any) {
    res.json({
      success: true,
      total: 0,
      breakdown: { students: 0, faculty: 0, staff: 0, alumni: 0 },
      contacts: []
    });
  }
});

// DELETE /api/contacts/:id - Remove individual contact
contactsRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await executeQuery('DELETE FROM campaign_recipients WHERE contact_id = ?', [id]);
    await executeQuery('DELETE FROM contact_consent WHERE contact_id = ?', [id]);
    await executeQuery('DELETE FROM contacts WHERE id = ?', [id]);

    await AuditService.log({
      userId: (req as any).user?.id || 'USR-001',
      userRole: (req as any).user?.role || 'SENDER',
      action: 'DELETE_CONTACT',
      entity: 'CONTACT',
      entityId: id,
      ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'],
      success: true,
      metadata: { contactId: id }
    });

    logger.info('CONTACT_DELETED', `Contact ${id} deleted successfully`);
    res.json({ success: true, message: 'Contact removed successfully' });
  } catch (err: any) {
    logger.error('DELETE_CONTACT_ERROR', `Failed deleting contact ${req.params.id}: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/contacts/clear - Remove all contacts (e.g. wipe test numbers before Excel import)
contactsRouter.post('/clear', async (req, res) => {
  try {
    await executeQuery('DELETE FROM campaign_recipients');
    await executeQuery('DELETE FROM contact_consent');
    await executeQuery('DELETE FROM contacts');

    await AuditService.log({
      userId: (req as any).user?.id || 'USR-001',
      userRole: (req as any).user?.role || 'SENDER',
      action: 'CLEAR_ALL_CONTACTS',
      entity: 'CONTACTS_DIRECTORY',
      ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'],
      success: true,
      metadata: { note: 'Purged all contacts to prepare clean registry' }
    });

    logger.info('ALL_CONTACTS_CLEARED', 'All contacts and test numbers cleared successfully');
    res.json({ success: true, message: 'All contacts and test numbers have been cleared successfully' });
  } catch (err: any) {
    logger.error('CLEAR_CONTACTS_ERROR', `Failed clearing contacts: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/contacts/departments - List all distinct departments in the system
contactsRouter.get('/departments', async (req, res) => {
  try {
    const rawDepts = await executeQuery(`
      SELECT 
        d.id, 
        d.code, 
        d.name,
        COUNT(c.id) as contact_count
      FROM departments d
      LEFT JOIN contacts c ON d.id = c.department_id
      GROUP BY d.id
      ORDER BY d.name ASC
    `);
    res.json({
      success: true,
      departments: Array.isArray(rawDepts) ? rawDepts : []
    });
  } catch (err: any) {
    res.json({
      success: true,
      departments: []
    });
  }
});

// GET /api/contacts/template - Download Sample Excel Template
contactsRouter.get('/template', (req, res) => {
  const sampleData = [
    {
      'Full Name': 'Aarav Sharma',
      'Mobile Number': '919309313044',
      'Category': 'STUDENT',
      'Department': 'Computer Science',
      'Roll Number': 'STU-2026-001'
    },
    {
      'Full Name': 'Priya Verma',
      'Mobile Number': '919876543210',
      'Category': 'STUDENT',
      'Department': 'Medicine',
      'Roll Number': 'STU-2026-002'
    },
    {
      'Full Name': 'Dr. Rajesh Gupta',
      'Mobile Number': '919123456789',
      'Category': 'FACULTY',
      'Department': 'Computer Science',
      'Roll Number': 'FAC-2026-010'
    },
    {
      'Full Name': 'Dr. Sunita Rao',
      'Mobile Number': '919811223344',
      'Category': 'FACULTY',
      'Department': 'Law',
      'Roll Number': 'FAC-2026-011'
    },
    {
      'Full Name': 'Vikram Malhotra',
      'Mobile Number': '919922334455',
      'Category': 'ALUMNI',
      'Department': 'Business School',
      'Roll Number': 'ALM-2022-108'
    }
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleData);
  XLSX.utils.book_append_sheet(wb, ws, 'University_Recipients');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="University_Recipients_Template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// GET /api/contacts/import-logs - Section 12 Excel Import History
contactsRouter.get('/import-logs', async (req, res) => {
  try {
    const rawLogs = await executeQuery(`
      SELECT 
        id, import_code, filename, file_size_bytes, rows_detected, rows_imported, rows_rejected, invalid_phone_records, processing_duration_ms as duration_ms, status, created_at
      FROM import_logs
      ORDER BY created_at DESC
      LIMIT 50
    `);
    res.json({
      success: true,
      import_logs: Array.isArray(rawLogs) ? rawLogs : []
    });
  } catch (err) {
    const store = getMemoryStore();
    res.json({
      success: true,
      import_logs: store.import_logs
    });
  }
});

// Helper category code to ID mapping
const CATEGORY_MAP: Record<string, string> = {
  STUDENT: 'CAT-STU',
  FACULTY: 'CAT-FAC',
  STAFF: 'CAT-STF',
  ALUMNI: 'CAT-ALM',
  CANDIDATE: 'CAT-CAN'
};

// POST /api/contacts/upload - Real Excel / CSV Parsing & MySQL Storage
contactsRouter.post('/upload', async (req, res) => {
  const startTime = Date.now();
  const { file_base64, filename, default_category, default_department, clear_existing } = req.body;

  if (!file_base64) {
    return res.status(400).json({ success: false, error: 'No file data received' });
  }

  // Ensure CANDIDATE category exists in MySQL to avoid foreign key failures
  try {
    await executeQuery(`
      INSERT INTO categories (id, code, name, description) VALUES
      ('CAT-CAN', 'CANDIDATE', 'Interview Candidates', 'Job and admission interview candidates')
      ON DUPLICATE KEY UPDATE name=VALUES(name)
    `);
  } catch (catErr: any) {
    // non-fatal
  }

  // If requested, purge previous contacts/test numbers before importing the new batch
  if (clear_existing === true || clear_existing === 'true') {
    try {
      await executeQuery('DELETE FROM campaign_recipients');
      await executeQuery('DELETE FROM contact_consent');
      await executeQuery('DELETE FROM contacts');
      logger.info('CONTACTS_PURGED_BEFORE_UPLOAD', 'Purged existing contacts prior to fresh spreadsheet import');
    } catch (clearErr: any) {
      logger.warn('CONTACTS_PURGE_WARN', `Pre-import clear warning: ${clearErr.message}`);
    }
  }

  const cleanFilename = filename || 'University_Recipients.xlsx';
  const importCode = `IMP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const importId = crypto.randomUUID();

  try {
    const buffer = Buffer.from(file_base64, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return res.status(400).json({ success: false, error: 'Uploaded spreadsheet is empty' });
    }

    let rowsImported = 0;
    let rowsRejected = 0;
    let invalidPhones = 0;
    let duplicatePhones = 0;
    let totalDetectedRows = 0;
    const seenHashesInBatch = new Set<string>();

    // 2. Fetch all existing departments for fast in-memory lookup
    const deptRows = await executeQuery('SELECT id, code, name FROM departments');
    const deptCache = new Map<string, string>(); // lowercase name -> id
    if (Array.isArray(deptRows)) {
      deptRows.forEach((d: any) => {
        if (d.name) deptCache.set(d.name.trim().toLowerCase(), d.id);
        if (d.code) deptCache.set(d.code.trim().toLowerCase(), d.id);
      });
    }

    // Helper: auto-discover or create department on the fly
    async function resolveDepartment(rawDeptName: string): Promise<string> {
      const cleanName = (rawDeptName || '').trim();
      if (!cleanName) return deptCache.get('cs') || 'DEP-CS';
      const key = cleanName.toLowerCase();
      if (deptCache.has(key)) {
        return deptCache.get(key)!;
      }

      // Check standard abbreviations
      if (/^cs$|computer\s*science/i.test(cleanName)) return deptCache.get('cs') || 'DEP-CS';
      if (/^med$|medicine/i.test(cleanName)) return deptCache.get('med') || 'DEP-MED';
      if (/^law$/i.test(cleanName)) return deptCache.get('law') || 'DEP-LAW';
      if (/^bus$|business|management/i.test(cleanName)) return deptCache.get('bus') || 'DEP-BUS';
      if (/^reg$|registrar/i.test(cleanName)) return deptCache.get('reg') || 'DEP-REG';

      // Generate a clean department code from department name
      const words = cleanName.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/);
      let shortCode = words.map(w => w.slice(0, 4).toUpperCase()).join('');
      if (shortCode.length < 2) shortCode = cleanName.slice(0, 4).toUpperCase();
      const newCode = `DEP-${shortCode.slice(0, 8)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const newId = crypto.randomUUID();

      try {
        await executeQuery(
          'INSERT INTO departments (id, code, name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
          [newId, newCode, cleanName.slice(0, 150)]
        );
        deptCache.set(key, newId);
        deptCache.set(newCode.toLowerCase(), newId);
        return newId;
      } catch (err: any) {
        logger.warn('DEPT_CREATE_FAIL', `Could not insert department '${cleanName}': ${err.message}`);
        return deptCache.get('cs') || 'DEP-CS';
      }
    }

    // Process EVERY sheet in the workbook (e.g. '8 30 Consol' and '10 30 Consol')
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      if (!Array.isArray(rawRows) || rawRows.length === 0) continue;
      totalDetectedRows += rawRows.length;

      // 1. Detect sheet type based on sheet name and column headers
      const cleanSheetName = sheetName.trim().toLowerCase();
      const firstRowKeys = Object.keys(rawRows[0] || {}).map(k => k.trim().toLowerCase());
      const isCandidateSheet = firstRowKeys.some(k => /candidate|applicant|application[\s_]*id|app[\s_]*id|reviewer/i.test(k))
        || /consol|nursing|batch|cbt/i.test(cleanSheetName);
      const isStudentSheet = !isCandidateSheet && firstRowKeys.some(k => /regno|reg_no|student[\s_]*name|semester|session/i.test(k));
      const isEmployeeSheet = !isCandidateSheet && firstRowKeys.some(k => /idno|id_no|stafftype|staff_type|phone_no|phoneno|officialemail/i.test(k));

      // Batch / Department naming based on sheet name (e.g. '8 30 Consol' -> Batch 1; '10 30 Consol' -> Batch 2)
      let defaultSheetDept = 'Nursing Department';
      if (/8[\s_:]*30|batch[\s_]*1/i.test(cleanSheetName)) {
        defaultSheetDept = 'Nursing - Batch 1 (8:30 AM)';
      } else if (/10[\s_:]*30|batch[\s_]*2/i.test(cleanSheetName)) {
        defaultSheetDept = 'Nursing - Batch 2 (10:30 AM)';
      } else if (/nursing/i.test(cleanFilename)) {
        defaultSheetDept = `Nursing (${sheetName.trim()})`;
      }

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];

        // Smart column discovery per row
        let rawName = '';
        let rawPhone = '';
        let rawCategory = '';
        let rawDept = '';
        let rawRoll = '';

        for (const [key, val] of Object.entries(row)) {
          const k = key.trim().toLowerCase();
          const v = String(val).trim();
          if (!v) continue;

          // Check for row-level timing column (e.g. 8:30 or 10:30)
          if (/timing|time|batch/i.test(k)) {
            if (/8[\s_:]*30/i.test(v)) {
              rawDept = 'Nursing - Batch 1 (8:30 AM)';
            } else if (/10[\s_:]*30/i.test(v)) {
              rawDept = 'Nursing - Batch 2 (10:30 AM)';
            }
          }

          // 1. Institutional / Application ID: Idno, Regno, Application ID, Roll Number, etc.
          if (/^(idno|id_no|empid|emp_id|employee_id|regno|reg_no|roll|enroll|application[\s_]*id|app[\s_]*id|applicant)/i.test(k) || k === 'id') {
            if (!rawRoll) rawRoll = v;
          }
          // 2. Mobile Phone (avoid email columns)
          else if (/phone|mobile|cell|contact/i.test(k) && !/email/i.test(k)) {
            if (!rawPhone) rawPhone = v;
          }
          // 3. Name (Ignore Session_Name, College, Degree, Department)
          else if (/^(candidate[\s_]*name|student[\s_]*name|full[\s_]*name|emp[\s_]*name|faculty[\s_]*name|name)$/i.test(k) || (/name/i.test(k) && !/session|college|degree|dept/i.test(k))) {
            if (!rawName) rawName = v;
          }
          // 4. Role / Staff Type / Category
          else if (/^(category|role|group|stafftype|staff_type)$/i.test(k)) {
            if (!rawCategory) rawCategory = v;
          }
          // 5. Department / Degree / College / Post
          else if (/^(dept|department|branch|post|position|designation)$/i.test(k)) {
            if (!rawDept) rawDept = v;
          } else if (!rawDept && /^(degree|college)$/i.test(k)) {
            rawDept = v;
          }
        }

        // Check phone validity
        const cleaned = cleanPhoneNumber(rawPhone);
        if (!cleaned || cleaned.length < 10 || cleaned.length > 15) {
          rowsRejected++;
          invalidPhones++;
          continue;
        }

        // Check duplicate within this batch
        const pHash = hashPhone(cleaned);
        if (seenHashesInBatch.has(pHash)) {
          rowsRejected++;
          duplicatePhones++;
          continue;
        }
        seenHashesInBatch.add(pHash);

        // Name extraction
        const nameParts = (rawName || 'Recipient').trim().split(/\s+/);
        const firstName = nameParts[0] || 'Recipient';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Smart Category Resolution:
        let categoryId = 'CAT-STU';
        const catVal = (rawCategory || '').toLowerCase();
        if (isCandidateSheet || catVal.includes('candidate') || catVal.includes('applicant') || catVal.includes('interview')) {
          categoryId = 'CAT-CAN';
        } else if (catVal.includes('teach') || catVal.includes('faculty') || catVal.includes('prof') || catVal.includes('lectur')) {
          categoryId = 'CAT-FAC';
        } else if (catVal.includes('non-teach') || catVal.includes('staff') || catVal.includes('admin') || catVal.includes('office') || catVal.includes('clerk') || catVal.includes('technical')) {
          categoryId = 'CAT-STF';
        } else if (catVal.includes('alumni') || catVal.includes('graduat')) {
          categoryId = 'CAT-ALM';
        } else if (catVal.includes('student')) {
          categoryId = 'CAT-STU';
        } else if (isEmployeeSheet) {
          categoryId = 'CAT-FAC';
        } else if (isStudentSheet) {
          categoryId = 'CAT-STU';
        } else if (default_category) {
          categoryId = CATEGORY_MAP[String(default_category).toUpperCase()] || 'CAT-STU';
        }

        // Dynamic Department Resolution:
        const fallbackDept = isCandidateSheet ? defaultSheetDept : (default_department || 'DEP-CS');
        const deptId = await resolveDepartment(rawDept || fallbackDept);

        // External Identifier (real Idno or Regno)
        const extId = rawRoll || `UNI-${Date.now().toString().slice(-6)}-${String(i + 1).padStart(3, '0')}`;
        const contactId = crypto.randomUUID();
        const pEncrypted = encryptPhone(cleaned);

        // Insert into MySQL contacts table (cleanly purging any stale conflicting records by external_identifier or phone_hash)
        try {
          await executeQuery('DELETE FROM contacts WHERE external_identifier = ? OR phone_hash = ?', [extId, pHash]);

          await executeQuery(`
            INSERT INTO contacts (
              id, external_identifier, first_name, last_name, category_id, department_id, phone_hash, phone_encrypted, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
          `, [
            contactId,
            extId,
            firstName,
            lastName,
            categoryId,
            deptId,
            pHash,
            pEncrypted
          ]);

          // Insert consent
          await executeQuery(`
            INSERT INTO contact_consent (
              id, contact_id, channel, status, consent_source
            ) VALUES (?, ?, 'WHATSAPP', 'OPTED_IN', 'EXCEL_IMPORT')
            ON DUPLICATE KEY UPDATE status = 'OPTED_IN'
          `, [crypto.randomUUID(), contactId]);

          rowsImported++;
        } catch (dbErr: any) {
          logger.warn('CONTACT_ROW_INSERT_FAIL', `Row ${i + 1} insert failed: ${dbErr.message}`);
          rowsRejected++;
        }
      }
    }

    if (totalDetectedRows === 0) {
      return res.status(400).json({ success: false, error: 'No data rows found across any sheets in spreadsheet' });
    }

    const durationMs = Date.now() - startTime;

    // Record in import_logs table in MySQL
    try {
      await executeQuery(`
        INSERT INTO import_logs (
          id, import_code, filename, uploader_id, file_size_bytes, rows_detected, rows_processed, rows_imported, rows_updated, rows_duplicated, rows_rejected, invalid_phone_records, invalid_category_records, missing_required_fields, processing_duration_ms, status
        ) VALUES (?, ?, ?, 'USR-001', ?, ?, ?, ?, 0, ?, ?, ?, 0, 0, ?, 'COMPLETED')
      `, [
        importId,
        importCode,
        cleanFilename,
        buffer.length,
        totalDetectedRows,
        totalDetectedRows,
        rowsImported,
        duplicatePhones,
        rowsRejected,
        invalidPhones,
        durationMs
      ]);
    } catch (logErr: any) {
      logger.warn('IMPORT_LOG_INSERT_FAIL', logErr.message);
    }

    // Also record audit log
    await AuditService.log({
      userId: 'USR-001',
      userRole: 'ROLE-SUPERADMIN',
      action: 'IMPORT_CONTACTS',
      entity: 'IMPORT',
      entityId: importCode,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'],
      success: true,
      metadata: {
        filename: cleanFilename,
        rows_detected: totalDetectedRows,
        rows_imported: rowsImported,
        rows_rejected: rowsRejected,
        invalid_phone_records: invalidPhones,
        duplicate_phone_records: duplicatePhones
      }
    });

    res.json({
      success: true,
      import_code: importCode,
      filename: cleanFilename,
      rows_detected: totalDetectedRows,
      rows_imported: rowsImported,
      rows_rejected: rowsRejected,
      invalid_phone_records: invalidPhones,
      duplicate_phone_records: duplicatePhones,
      duration_ms: durationMs
    });
  } catch (err: any) {
    logger.error('EXCEL_IMPORT_ERROR', `Failed processing Excel file: ${err.message}`);
    res.status(500).json({ success: false, error: `Spreadsheet processing error: ${err.message}` });
  }
});
