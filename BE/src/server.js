const { app } = require('./app');
const { initDatabase } = require('./db');

const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
const missingEnv = requiredEnv.filter((key) => !String(process.env[key] || '').trim());

if (missingEnv.length > 0) {
  console.error(`Thiếu biến môi trường bắt buộc: ${missingEnv.join(', ')}`);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && !String(process.env.CORS_ORIGIN || '').trim()) {
  console.error('Thiếu CORS_ORIGIN ở môi trường production.');
  process.exit(1);
}

const port = Number(process.env.PORT || 4000);

(async () => {
  try {
    await initDatabase();
    app.listen(port, () => {
      console.log(`T3H backend API đang chạy trên cổng ${port}`);
    });
  } catch (error) {
    console.error('Không thể khởi tạo cơ sở dữ liệu:', error);
    process.exit(1);
  }
})();
