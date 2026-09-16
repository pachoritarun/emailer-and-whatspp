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

function cleanPhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  let str = String(rawPhone).trim().replace(/\D/g, '');
  if (str.length === 10) str = '91' + str;
  if (str.length === 11 && str.startsWith('0')) str = '91' + str.slice(1);
  return str;
}

function hashPhone(phone) {
  const cleaned = cleanPhoneNumber(phone);
  return crypto.createHash('sha256').update(cleaned).digest('hex');
}

function encryptPhone(phone) {
  const cleaned = cleanPhoneNumber(phone);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY_BUFFER, iv);
  const encrypted = Buffer.concat([cipher.update(cleaned, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

/**
 * Replace the dummy phone numbers below with your 10 actual phone numbers!
 * Format can be: "9876543210" or "+919876543210" or "919876543210"
 */
const CONTACTS_DATA = [
  {
    id: 'STU-YUVRAJ-001',
    firstName: 'Yuvraj',
    lastName: '',
    phone: process.env.PHONE_1 || '919800000001',
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
    phone: process.env.PHONE_2 || '919800000002',
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
    phone: process.env.PHONE_3 || '919800000003',
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
    phone: process.env.PHONE_4 || '919800000004',
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
    phone: process.env.PHONE_5 || '919800000005',
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
    phone: process.env.PHONE_6 || '919800000006',
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
    phone: process.env.PHONE_7 || '919800000007',
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
    phone: process.env.PHONE_8 || '919800000008',
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
    phone: process.env.PHONE_9 || '919800000009',
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
    phone: process.env.PHONE_10 || '919800000010',
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

  for (const c of CONTACTS_DATA) {
    const cleaned = cleanPhoneNumber(c.phone);
    const pHash = hashPhone(cleaned);
    const pEnc = encryptPhone(cleaned);
    const contactUuid = crypto.randomUUID();

    // Insert into contacts table (tokenized & AES-256 encrypted)
    await conn.query(`
      INSERT INTO contacts (
        id, external_identifier, first_name, last_name, category_id, department_id, phone_hash, phone_encrypted, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        category_id = VALUES(category_id),
        department_id = VALUES(department_id),
        phone_hash = VALUES(phone_hash),
        phone_encrypted = VALUES(phone_encrypted),
        is_active = 1
    `, [
      contactUuid,
      c.id,
      c.firstName,
      c.lastName,
      c.categoryId,
      c.departmentId,
      pHash,
      pEnc
    ]);

    // Ensure opt-in consent record
    await conn.query(`
      INSERT INTO contact_consent (
        id, contact_id, channel, status, consent_source
      ) VALUES (?, (SELECT id FROM contacts WHERE external_identifier = ? LIMIT 1), 'WHATSAPP', 'OPTED_IN', 'PORTAL_TEST_SEED')
      ON DUPLICATE KEY UPDATE status = 'OPTED_IN'
    `, [
      crypto.randomUUID(),
      c.id
    ]);

    insertedCount++;
    console.log(` ✅ Seeded: ${c.firstName.padEnd(10)} | ${c.category.padEnd(8)} | ${c.department.padEnd(12)} | Phone: ${cleaned}`);
  }

  await conn.end();

  console.log(`\n🎉 Successfully configured ${insertedCount} test contacts in MySQL!`);
  console.log('You can now see them in the Recipient Directory and send targeted notices to Students, Faculty, or Alumni.\n');
}

seed().catch(err => {
  console.error('❌ Error seeding contacts:', err);
  process.exit(1);
});
