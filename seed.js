const mysql = require('mysql2/promise');

async function seed() {
  console.log("Starting database initialization and seeding...");
  
  const host = process.env.DB_HOST || "localhost";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = "jecrc_broadcast";

  try {
    // 1. Connect without database to create it
    console.log(`Connecting to MySQL at ${user}@${host}:${port}...`);
    const initConn = await mysql.createConnection({ host, port, user, password });
    await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await initConn.end();
    console.log(`Verified database '${database}'.`);

    // 2. Connect to the database to create tables and insert data
    const pool = mysql.createPool({ host, port, user, password, database });

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
    
    // Sample demo contacts
    const contacts = [
      { name: "Demo Student", phone: "919999999999", email: "student@example.com", role: "Student" },
      { name: "Demo Faculty", phone: "918888888888", email: "faculty@example.com", role: "Faculty" },
      { name: "Demo Alumni",  phone: "917777777777", email: "alumni@example.com", role: "Alumni" }
    ];

    for (const c of contacts) {
      await pool.query(
        "INSERT INTO contacts (name, phone, email, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), phone=VALUES(phone)",
        [c.name, c.phone, c.email, c.role]
      );
      console.log(`Successfully seeded contact: ${c.name} as ${c.role}`);
    }

    console.log("Database seeded completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding process failed:", error.message);
    process.exit(1);
  }
}

seed();
