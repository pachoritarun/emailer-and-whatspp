import mysql from 'mysql2/promise';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function clearContacts() {
  console.log('🧹 Purging all contacts from the database...');

  const dbUrl = process.env.DATABASE_URL;
  let connectionConfig;

  if (dbUrl) {
    const parsed = new URL(dbUrl);
    connectionConfig = {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 3306,
      user: parsed.username || 'root',
      password: decodeURIComponent(parsed.password || ''),
      database: parsed.pathname.replace(/^\//, '') || 'Communication_DB',
      multipleStatements: true
    };
  } else {
    connectionConfig = {
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'Mysqlserver469',
      database: process.env.MYSQL_DATABASE || 'Communication_DB',
      multipleStatements: true
    };
  }

  const conn = await mysql.createConnection(connectionConfig);

  try {
    await conn.query('DELETE FROM campaign_recipients');
    await conn.query('DELETE FROM contact_consent');
    const [res] = await conn.query('DELETE FROM contacts');

    console.log(`✅ All test contacts successfully removed! (${res.affectedRows || 0} contacts deleted)`);
    console.log('🎉 Recipient directory is now completely clean and ready for new Excel spreadsheet upload.');
  } catch (err) {
    console.error('❌ Failed to clear contacts:', err.message);
  } finally {
    await conn.end();
  }
}

clearContacts();
