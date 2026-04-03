require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { pool, initDatabase } = require("../src/db");
const { inferEnterpriseFromBranch } = require("../src/utils/organization");

const DEFAULT_USERS = [
  {
    username: "admin",
    password: "Admin@2026",
    role: "admin",
    displayName: "Quản trị hệ thống",
    branch: null,
  },
  {
    username: "saigon",
    password: "SaiGon@2026",
    role: "cungtruong",
    displayName: "Cung trưởng Cung Sài Gòn",
    branch: "Cung Sài Gòn",
  },
  {
    username: "giaray",
    password: "GiaRay@2026",
    role: "cungtruong",
    displayName: "Cung trưởng Cung Gia Ray",
    branch: "Cung Gia Ray",
  },
  {
    username: "longkhanh",
    password: "LongKhanh@2026",
    role: "cungtruong",
    displayName: "Cung trưởng Cung Long Khánh",
    branch: "Cung Long Khánh",
  },
  {
    username: "trangbom",
    password: "TrangBom@2026",
    role: "cungtruong",
    displayName: "Cung trưởng Cung Trảng Bom",
    branch: "Cung Trảng Bom",
  },
  {
    username: "songthan",
    password: "SongThan@2026",
    role: "cungtruong",
    displayName: "Cung trưởng Cung Sóng Thần",
    branch: "Cung Sóng Thần",
  },
];

function shouldReset() {
  return process.argv.includes("--reset") || process.env.SEED_MODE === "reset";
}

function assertSafeToSeed() {
  if (shouldReset() && process.env.NODE_ENV === "production" && process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    throw new Error(
      "Chặn seed reset trên production. Chỉ tiếp tục khi thực sự cần bằng cách đặt ALLOW_DESTRUCTIVE_SEED=true.",
    );
  }
}

async function resetData(branches) {
  await pool.query("DELETE FROM notifications");
  await pool.query("DELETE FROM password_reset_requests");
  await pool.query("DELETE FROM users");
  await pool.query("DELETE FROM app_documents WHERE key = $1", ["branches_tree"]);

  for (const user of DEFAULT_USERS) {
    const hash = await bcrypt.hash(user.password, 10);
    await pool.query(
      `INSERT INTO users(username, password_hash, role, display_name, enterprise_name, branch_name, status)
       VALUES ($1,$2,$3,$4,$5,$6,'active')`,
      [
        user.username,
        hash,
        user.role,
        user.displayName,
        user.branch ? inferEnterpriseFromBranch(user.branch) : null,
        user.branch,
      ],
    );
  }

  await pool.query(
    `INSERT INTO app_documents(key, data, updated_at)
     VALUES ($1, $2::jsonb, NOW())`,
    ["branches_tree", JSON.stringify(branches)],
  );
}

async function seedUsersSafely() {
  for (const user of DEFAULT_USERS) {
    const existingUser = await pool.query(
      `SELECT id FROM users WHERE username = $1 LIMIT 1`,
      [user.username],
    );

    if (existingUser.rowCount > 0) {
      await pool.query(
        `UPDATE users
         SET role = $2,
             display_name = $3,
             enterprise_name = $4,
             branch_name = $5,
             status = 'active'
         WHERE username = $1`,
        [
          user.username,
          user.role,
          user.displayName,
          user.branch ? inferEnterpriseFromBranch(user.branch) : null,
          user.branch,
        ],
      );
      continue;
    }

    const hash = await bcrypt.hash(user.password, 10);
    await pool.query(
      `INSERT INTO users(username, password_hash, role, display_name, enterprise_name, branch_name, status)
       VALUES ($1,$2,$3,$4,$5,$6,'active')`,
      [
        user.username,
        hash,
        user.role,
        user.displayName,
        user.branch ? inferEnterpriseFromBranch(user.branch) : null,
        user.branch,
      ],
    );
  }
}

async function ensureDefaultTree(branches) {
  await pool.query(
    `INSERT INTO app_documents(key, data, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key)
     DO NOTHING`,
    ["branches_tree", JSON.stringify(branches)],
  );
}

async function main() {
  assertSafeToSeed();
  await initDatabase();

  const seedPath = path.resolve(__dirname, "../seed-data/branches.json");
  const branches = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const resetMode = shouldReset();

  await pool.query("BEGIN");

  try {
    if (resetMode) {
      await resetData(branches);
    } else {
      await seedUsersSafely();
      await ensureDefaultTree(branches);
    }

    await pool.query("COMMIT");
    console.log(
      resetMode
        ? "Đã reset và seed lại dữ liệu mặc định."
        : "Đã seed an toàn: thêm tài khoản mặc định còn thiếu và giữ nguyên dữ liệu hiện có.",
    );
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
