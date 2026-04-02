# T3H-web dùng API backend

## 1. Cấu hình
Tạo file `.env` từ `.env.example`:

```env
https://t3h-backend-api.onrender.com
```

## 2. Những file đã đổi
- `src/utils/api.js`
- `src/utils/auth.js`
- `src/utils/systemsStorage.js`
- `src/utils/passwordResetRequests.js`
- `src/utils/notificationsStorage.js`
- `src/views/Login.js`
- `src/views/UserProfile.js`
- `src/views/TableList.js`
- `src/views/Dashboard.js`
- `src/views/Notifications.js`
- `src/components/Navbars/AdminNavbar.js`

## 3. Cách chạy
1. Chạy backend Node/PostgreSQL ở `http://localhost:4000/api`
2. Chạy frontend React:
   ```bash
   npm install
   npm start
   ```

## 4. Lưu ý
- Frontend chỉ còn lưu **phiên đăng nhập** (`user`, `token`) ở localStorage.
- Dữ liệu users, cây tài sản, yêu cầu quên mật khẩu và thông báo đều gọi API.
