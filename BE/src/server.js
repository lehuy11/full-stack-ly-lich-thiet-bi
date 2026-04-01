const { app } = require('./app');
const { initDatabase } = require('./db');

const port = Number(process.env.PORT || 4000);

(async () => {
  try {
    await initDatabase();
    app.listen(port, () => {
      console.log(`T3H backend API đang chạy tại http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Không thể khởi tạo cơ sở dữ liệu:', error);
    process.exit(1);
  }
})();
