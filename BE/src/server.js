const { app } = require('./app');

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`T3H backend API đang chạy tại http://localhost:${port}`);
});
