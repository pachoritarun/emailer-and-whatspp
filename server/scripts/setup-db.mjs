import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  console.log('🔄 Initializing University Portal Database on Local MySQL...');

  const dbUrl = process.env.DATABASE_URL || 'mysql://root:Mysqlserver469@localhost:3306/university_portal';
  const parsed = new URL(dbUrl);
  const host = parsed.hostname || 'localhost';
  const port = parsed.port ? parseInt(parsed.port, 10) : 3306;
  const user = parsed.username || 'root';
  const password = decodeURIComponent(parsed.password || '');
  const database = parsed.pathname.replace(/^\//, '') || 'university_portal';

  console.log(`📡 Connecting to MySQL at ${host}:${port} as user '${user}'...`);

  // Connect without database first to ensure database exists
  const rootConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true
  });

  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  console.log(`✅ Database '${database}' ready.`);
  await rootConn.end();

  // Connect to target database
  const dbConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true
  });

  const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
  const seedPath = path.resolve(__dirname, '../../database/seed.sql');

  console.log(`📄 Executing schema: ${schemaPath}...`);
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await dbConn.query(schemaSql);
  console.log('✅ Schema tables created successfully (20 tables).');

  console.log(`🌱 Executing seed data: ${seedPath}...`);
  const seedSql = fs.readFileSync(seedPath, 'utf8');
  await dbConn.query(seedSql);
  console.log('✅ Seed records inserted successfully.');

  const [tables] = await dbConn.query('SHOW TABLES');
  console.log(`\n🎉 Verification complete: Found ${tables.length} tables in '${database}':`);
  tables.forEach((t) => {
    console.log(`   - ${Object.values(t)[0]}`);
  });

  await dbConn.end();
  console.log('\n🚀 MySQL setup complete! You are ready to run the server.');
}

run().catch((err) => {
  console.error('❌ Database setup failed:', err.message);
  process.exit(1);
});
