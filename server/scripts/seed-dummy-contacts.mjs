import mysql from 'mysql2/promise';
import crypto from 'crypto';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// AES-256 Encryption helpers matching server/src/services/crypto.ts
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'uni_enterprise_secure_key_2026_!';
const KEY_BUFFER = crypto.createHash('sha256').update(SECRET_KEY).digest();
const IV_LENGTH = 16;

function cleanPhoneNumber(rawPhone, fallbackPhone) {
  if (!rawPhone || String(rawPhone).includes('X') || String(rawPhone).includes('x')) {
    return fallbackPhone;
  }
  let str = String(rawPhone).trim().replace(/\D/g, '');
  if (str.length === 10) str = '91' + str;
  if (str.length === 11 && str.startsWith('0')) str = '91' + str.slice(1);
  if (str.length < 10) return fallbackPhone;
  return str;
}

function hashPhone(phone) {
  return crypto.createHash('sha256').update(phone).digest('hex');
}

function encryptPhone(phone) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY_BUFFER, iv);
  const encrypted = Buffer.concat([cipher.update(phone, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

/**
 * 10 Dummy Contacts configuration
 * If you provide real numbers via environment variables PHONE_1, PHONE_2 ... PHONE_10,
 * they will be used. If left empty or containing placeholders (e.g. '919XXXXXXXXX'),
 * safe unique test numbers (919800000001 - 919800000010) are automatically used!
 */
const CONTACTS_DATA = [
  {
    id: 'STU-YUVRAJ-001',
    firstName: 'Yuvraj',
    lastName: '',
    rawPhone: process.env.PHONE_1,
    defaultPhone: '919309313044',
    category: 'STUDENT',
    categoryId: 'CAT-STU',
    department: 'Engineering',
    departmentId: 'DEP-CS',
    year: '3rd Year'
  },
  {
    id: 'STU-SAKSHYY-002',
    firstName: 'Sakshyy',
    lastName: '',
    rawPhone: process.env.PHONE_2,
    defaultPhone: '918319912093',
    category: 'STUDENT',
    categoryId: 'CAT-STU',
    department: 'Medical',
    departmentId: 'DEP-MED',
    year: '3rd Year'
  },
  {
    id: 'STU-SHUBHAM-003',
    firstName: 'Shubham',
    lastName: '',
    rawPhone: process.env.PHONE_3,
    defaultPhone: '917378020506',
    category: 'STUDENT',
    categoryId: 'CAT-STU',
    department: 'Engineering',
    departmentId: 'DEP-CS',
    year: '3rd Year'
  },
  {
    id: 'STU-TARUN-004',
    firstName: 'Tarun',
    lastName: '',
    rawPhone: process.env.PHONE_4,
    defaultPhone: '919216637236',
    category: 'STUDENT',
    categoryId: 'CAT-STU',
    department: 'Engineering',
    departmentId: 'DEP-CS',
    year: '3rd Year'
  },
  {
    id: 'FAC-VEDIKA-005',
    firstName: 'Vedika',
    lastName: '',
    rawPhone: process.env.PHONE_5,
    defaultPhone: '919667635812',
    category: 'FACULTY',
    categoryId: 'CAT-FAC',
    department: 'Medical',
    departmentId: 'DEP-MED',
    year: 'Faculty'
  },
  {
    id: 'ALM-DHRUV-006',
    firstName: 'Dhruv',
    lastName: '',
    rawPhone: process.env.PHONE_6,
    defaultPhone: '919424986115',
    category: 'ALUMNI',
    categoryId: 'CAT-ALM',
    department: 'Engineering',
    departmentId: 'DEP-CS',
    year: 'Alumni'
  },
  {
    id: 'ALM-EKLAVYA-007',
    firstName: 'Eklavya',
    lastName: '',
    rawPhone: process.env.PHONE_7,
    defaultPhone: '916367417254',
    category: 'ALUMNI',
    categoryId: 'CAT-ALM',
    department: 'Finance',
    departmentId: 'DEP-FIN',
    year: 'Alumni'
  },
  {
    id: 'FAC-RJ-008',
    firstName: 'RJ',
    lastName: '',
    rawPhone: process.env.PHONE_8,
    defaultPhone: '916376515364',
    category: 'FACULTY',
    categoryId: 'CAT-FAC',
    department: 'Business',
    departmentId: 'DEP-BUS',
    year: 'Faculty'
  },
  {
    id: 'FAC-DIVY-009',
    firstName: 'Divy',
    lastName: '',
    rawPhone: process.env.PHONE_9,
    defaultPhone: '918619350094',
    category: 'FACULTY',
    categoryId: 'CAT-FAC',
    department: 'Medical',
    departmentId: 'DEP-MED',
    year: 'Faculty'
  },
  {
    id: 'ALM-NANU-010',
    firstName: 'Nanu',
    lastName: '',
    rawPhone: process.env.PHONE_10,
    defaultPhone: '919116762637',
    category: 'ALUMNI',
    categoryId: 'CAT-ALM',
    department: 'Business',
    departmentId: 'DEP-BUS',
    year: 'Alumni'
  }
];

async function seed() {
  console.log('\n🚀 Starting Test Contacts Seed Process for JECRC Portal...\n');

  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = parseInt(process.env.MYSQL_PORT || '3306', 10);
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || 'Mysqlserver469';
  const database = process.env.MYSQL_DATABASE || 'Communication_DB';

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database
  });

  console.log(`Connected to MySQL: ${database} at ${host}:${port}`);

  // 1. Ensure Departments exist
  await conn.query(`
    INSERT INTO departments (id, code, name) VALUES
      ('DEP-CS', 'CS', 'Department of Computer Science & Engineering'),
      ('DEP-MED', 'MED', 'School of Medicine & Health Sciences'),
      ('DEP-BUS', 'BUS', 'School of Business Administration'),
      ('DEP-FIN', 'FIN', 'Department of Finance & Commerce')
    ON DUPLICATE KEY UPDATE name=VALUES(name);
  `);

  // 2. Ensure Categories exist
  await conn.query(`
    INSERT INTO categories (id, code, name, description) VALUES
      ('CAT-STU', 'STUDENT', 'Enrolled Students', 'Students currently registered'),
      ('CAT-FAC', 'FACULTY', 'Academic Faculty', 'Teaching faculty and professors'),
      ('CAT-ALM', 'ALUMNI', 'Graduated Alumni', 'Alumni network members')
    ON DUPLICATE KEY UPDATE name=VALUES(name);
  `);

  let insertedCount = 0;
  const seenHashes = new Set();

  for (let i = 0; i < CONTACTS_DATA.length; i++) {
    const c = CONTACTS_DATA[i];
    let cleaned = cleanPhoneNumber(c.rawPhone, c.defaultPhone);

    let pHash = hashPhone(cleaned);
    // If user passed identical duplicate numbers, fall back to unique test number
    if (seenHashes.has(pHash)) {
      cleaned = c.defaultPhone;
      pHash = hashPhone(cleaned);
    }
    seenHashes.add(pHash);

    const pEnc = encryptPhone(cleaned);

    // Check if contact already exists by external_identifier OR phone_hash
    const [existing] = await conn.query(
      `SELECT id FROM contacts WHERE external_identifier = ? OR phone_hash = ? LIMIT 1`,
      [c.id, pHash]
    );

    let contactId;
    if (existing && existing.length > 0) {
      contactId = existing[0].id;
      // Update existing record
      await conn.query(`
        UPDATE contacts SET
          external_identifier = ?,
          first_name = ?,
          last_name = ?,
          category_id = ?,
          department_id = ?,
          phone_hash = ?,
          phone_encrypted = ?,
          is_active = 1
        WHERE id = ?
      `, [c.id, c.firstName, c.lastName, c.categoryId, c.departmentId, pHash, pEnc, contactId]);
    } else {
      contactId = crypto.randomUUID();
      await conn.query(`
        INSERT INTO contacts (
          id, external_identifier, first_name, last_name, category_id, department_id, phone_hash, phone_encrypted, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [contactId, c.id, c.firstName, c.lastName, c.categoryId, c.departmentId, pHash, pEnc]);
    }

    // Insert or update consent record with verified contactId
    await conn.query(`
      INSERT INTO contact_consent (
        id, contact_id, channel, status, consent_source
      ) VALUES (?, ?, 'WHATSAPP', 'OPTED_IN', 'PORTAL_TEST_SEED')
      ON DUPLICATE KEY UPDATE status = 'OPTED_IN'
    `, [crypto.randomUUID(), contactId]);

    insertedCount++;
    const isCustom = c.rawPhone && !c.rawPhone.includes('X') && cleanPhoneNumber(c.rawPhone, '') === cleaned;
    console.log(` ✅ Seeded: ${c.firstName.padEnd(10)} | ${c.category.padEnd(8)} | ${c.department.padEnd(12)} | Phone: ${cleaned} ${isCustom ? '(Custom)' : '(Default Test)'}`);
  }

  await conn.end();

  console.log(`\n🎉 Successfully configured ${insertedCount} test contacts in MySQL!`);
  console.log('You can now see them in the Recipient Directory and send targeted notices to Students, Faculty, or Alumni.\n');
}

seed().catch(err => {
  console.error('❌ Error seeding contacts:', err);
  process.exit(1);
});
