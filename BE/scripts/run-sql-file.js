require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    throw new Error('Thiếu đường dẫn file SQL. Ví dụ: npm run db:init');
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  const sql = fs.readFileSync(filePath, 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await pool.query(sql);
    console.log(`Đã chạy xong file SQL: ${fileArg}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
