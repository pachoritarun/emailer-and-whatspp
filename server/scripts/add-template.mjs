import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection('mysql://root:Mysqlserver469@localhost:3306/university_portal');
  await conn.execute(
    `INSERT INTO message_templates (id, name, meta_template_id, category, language, header_type, body_text, footer_text, sample_variables, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE body_text=VALUES(body_text)`,
    [
      'TPL-GANESH-CHATURTHI',
      'ganesh_chaturthi',
      'meta_tpl_ganesh_01',
      'MARKETING',
      'en',
      'NONE',
      'Warm greetings on Ganesh Chaturthi, {{1}}! May Lord Ganesha shower wisdom, happiness, and prosperity upon you and your family.',
      'JECRC University • Official Greetings',
      JSON.stringify(['[Student Name]']),
      'APPROVED',
      'USR-001'
    ]
  );
  console.log('✅ Template ganesh_chaturthi inserted into MySQL message_templates table!');
  const [rows] = await conn.query('SELECT id, name, category, language, status FROM message_templates');
  console.log('Current templates in database:');
  console.table(rows);
  await conn.end();
}

main().catch(console.error);
