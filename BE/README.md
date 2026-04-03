# T3H Backend API (Node.js + PostgreSQL)

Bộ backend này được viết để thay localStorage của `T3H-web` bằng API thật.

## 1. Công nghệ
- PostgreSQL
- pgAdmin4 để quản trị DB
- Node.js + Express
- JWT cho đăng nhập
- `pg` để kết nối PostgreSQL

## 2. Chuẩn bị database
1. Tạo database mới trong PostgreSQL, ví dụ `t3h_assets`.
2. Chạy:
   ```bash
   npm install
   npm run db:init
   npm run seed
   ```

## 3. Chạy backend
```bash
npm run dev
```

Mặc định API chạy tại:
```text
http://localhost:4000/api
```

## 4. Endpoint chính
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/users`
- `POST /api/users`
- `POST /api/users/:username/reset-password`
- `GET /api/branches/tree`
- `PUT /api/branches/tree`
- `GET /api/password-reset-requests`
- `POST /api/password-reset-requests`
- `PATCH /api/password-reset-requests/:username/resolve`
- `GET /api/notifications`
- `POST /api/notifications`
- `DELETE /api/notifications`

