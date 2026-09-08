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
      alumni: 0
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
  ALUMNI: 'CAT-ALM'
};

// Helper department mapping
const DEPT_MAP: Record<string, string> = {
  CS: 'DEP-CS',
  COMPUTERSCIENCE: 'DEP-CS',
  ENGINEERING: 'DEP-CS',
  MED: 'DEP-MED',
  MEDICINE: 'DEP-MED',
  LAW: 'DEP-LAW',
  BUS: 'DEP-BUS',
  BUSINESS: 'DEP-BUS',
  REG: 'DEP-REG',
  REGISTRAR: 'DEP-REG'
};

// POST /api/contacts/upload - Real Excel / CSV Parsing & MySQL Storage
contactsRouter.post('/upload', async (req, res) => {
  const startTime = Date.now();
  const { file_base64, filename, default_category, default_department } = req.body;

  if (!file_base64) {
    return res.status(400).json({ success: false, error: 'No file data received' });
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

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return res.status(400).json({ success: false, error: 'No data rows found in spreadsheet' });
    }

    let rowsImported = 0;
    let rowsRejected = 0;
    let invalidPhones = 0;
    const seenHashesInBatch = new Set<string>();

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];

      // Flexible column discovery
      let rawName = '';
      let rawPhone = '';
      let rawCategory = default_category || 'STUDENT';
      let rawDept = default_department || 'DEP-CS';
      let rawRoll = '';

      for (const [key, val] of Object.entries(row)) {
        const k = key.trim().toLowerCase();
        const v = String(val).trim();
        if (!v) continue;

        if (/roll|reg|enroll|emp/i.test(k) || k === 'id') {
          rawRoll = v;
        } else if (/phone|mobile|cell|contact/i.test(k)) {
          rawPhone = v;
        } else if (/name/i.test(k)) {
          rawName = v;
        } else if (/cat|role|group/i.test(k)) {
          rawCategory = v;
        } else if (/dept|branch/i.test(k)) {
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
        continue;
      }
      seenHashesInBatch.add(pHash);

      // Name extraction
      const nameParts = (rawName || 'Recipient').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Recipient';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Category extraction & normalization
      const normCatKey = String(rawCategory).toUpperCase().trim();
      let categoryId = CATEGORY_MAP[normCatKey] || CATEGORY_MAP[default_category || 'STUDENT'] || 'CAT-STU';

      // Department normalization
      const normDeptKey = String(rawDept).toUpperCase().replace(/[^A-Z]/g, '');
      let deptId = DEPT_MAP[normDeptKey] || DEPT_MAP[default_department || 'DEP-CS'] || 'DEP-CS';

      // External Identifier
      const extId = rawRoll || `UNI-${Date.now().toString().slice(-6)}-${String(i + 1).padStart(3, '0')}`;
      const contactId = crypto.randomUUID();
      const pEncrypted = encryptPhone(cleaned);

      // Upsert into MySQL contacts table
      try {
        await executeQuery(`
          INSERT INTO contacts (
            id, external_identifier, first_name, last_name, category_id, department_id, phone_hash, phone_encrypted, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE
            first_name = VALUES(first_name),
            last_name = VALUES(last_name),
            category_id = VALUES(category_id),
            department_id = VALUES(department_id),
            phone_encrypted = VALUES(phone_encrypted),
            is_active = 1
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

    const durationMs = Date.now() - startTime;

    // Record in import_logs table in MySQL
    try {
      await executeQuery(`
        INSERT INTO import_logs (
          id, import_code, filename, uploader_id, file_size_bytes, rows_detected, rows_processed, rows_imported, rows_updated, rows_duplicated, rows_rejected, invalid_phone_records, invalid_category_records, missing_required_fields, processing_duration_ms, status
        ) VALUES (?, ?, ?, 'USR-001', ?, ?, ?, ?, 0, 0, ?, ?, 0, 0, ?, 'COMPLETED')
      `, [
        importId,
        importCode,
        cleanFilename,
        buffer.length,
        rawRows.length,
        rawRows.length,
        rowsImported,
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
        rows_detected: rawRows.length,
        rows_imported: rowsImported,
        rows_rejected: rowsRejected
      }
    });

    res.json({
      success: true,
      import_code: importCode,
      filename: cleanFilename,
      rows_detected: rawRows.length,
      rows_imported: rowsImported,
      rows_rejected: rowsRejected,
      invalid_phone_records: invalidPhones,
      duration_ms: durationMs
    });
  } catch (err: any) {
    logger.error('EXCEL_IMPORT_ERROR', `Failed processing Excel file: ${err.message}`);
    res.status(500).json({ success: false, error: `Spreadsheet processing error: ${err.message}` });
  }
});
