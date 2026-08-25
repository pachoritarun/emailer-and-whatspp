import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export async function getDbPool(): Promise<mysql.Pool> {
  if (pool) return pool;

  const host = process.env.DB_HOST || "localhost";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_DATABASE || "jecrc_broadcast";

  try {
    const initConn = await mysql.createConnection({ host, port, user, password });
    await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await initConn.end();
  } catch (error) {
    console.error("Database connection/creation check failed:", error);
  }

  pool = mysql.createPool({
    host, port, user, password, database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_contact (email, role)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS broadcast_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recipient_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        message_body TEXT NOT NULL,
        whatsapp_status VARCHAR(50) NOT NULL,
        whatsapp_error TEXT,
        email_status VARCHAR(50) NOT NULL,
        email_error TEXT,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS broadcast_jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        broadcast_id VARCHAR(64) NOT NULL,
        recipient_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        role VARCHAR(50) NOT NULL,
        template_name VARCHAR(255) NOT NULL,
        template_lang VARCHAR(20) NOT NULL DEFAULT 'en_US',
        template_vars JSON,
        status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
        error_msg TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP NULL,
        INDEX idx_broadcast_status (broadcast_id, status)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS local_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        language VARCHAR(20) NOT NULL DEFAULT 'en_US',
        body TEXT,
        variable_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed defaults
    await pool.query(`
      INSERT IGNORE INTO local_templates (name, language, body, variable_count)
      VALUES 
      ('student_notice', 'en_US', 'Dear {{1}}, this is JECRC Administration. Please note that: {{2}}.', 2),
      ('exam_alert', 'en_US', 'Dear {{1}}, your exam hall ticket for {{2}} is ready.', 2)
    `);

    console.log("Database tables verified and seeded successfully.");
  } catch (error) {
    console.error("Database table initialization failed:", error);
  }

  return pool;
}
