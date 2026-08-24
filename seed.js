const { getDbPool } = require('./src/lib/db');

async function seed() {
  console.log("Starting database seeding...");
  try {
    const pool = await getDbPool();
    
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

    console.log("Database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding process failed:", error);
    process.exit(1);
  }
}

seed();
