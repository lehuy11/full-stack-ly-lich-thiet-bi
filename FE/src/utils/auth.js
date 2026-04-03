import { inferEnterpriseFromBranch } from "./organization";
import { apiRequest, AUTH_TOKEN_STORAGE_KEY } from "./api";

export const AUTH_STORAGE_KEY = "t3h_auth_user";
export const USERS_UPDATED_EVENT = "t3h-users-updated";
export const AUTH_UPDATED_EVENT = "t3h-auth-updated";

export const MOCK_USERS = [];

function dispatchWindowEvent(name) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(name));
  }
}

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName || user.display_name || user.username,
    enterprise: user.enterprise || user.enterprise_name || inferEnterpriseFromBranch(user.branch || user.branch_name || "") || null,
    branch: user.branch || user.branch_name || null,
    loginAt: user.loginAt || user.last_login_at || null,
    createdAt: user.createdAt || user.created_at || null,
    passwordUpdatedAt: user.passwordUpdatedAt || user.password_updated_at || null,
  };
}

function saveAuthSession({ user, token }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sanitizeUser(user)));
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  }
  dispatchWindowEvent(AUTH_UPDATED_EVENT);
}

function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  dispatchWindowEvent(AUTH_UPDATED_EVENT);
}

function makeRandomBlock(length = 4) {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase();
}

export function generateUniquePassword() {
  return `T3H-${makeRandomBlock(4)}-${makeRandomBlock(4)}`;
}

export function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function getRoleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "cungtruong") return "Cung trưởng";
  return "Người dùng";
}

export function formatLoginTime(value) {
  return formatDateTime(value);
}

export async function login(username, password) {
  try {
    const result = await apiRequest("/auth/login", {
      method: "POST",
      body: {
        username: String(username || "").trim(),
        password: String(password || ""),
      },
      auth: false,
    });

    saveAuthSession({ user: result.user, token: result.token });

    return {
      success: true,
      user: sanitizeUser(result.user),
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Đăng nhập thất bại.",
    };
  }
}

export async function logout() {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } catch (_error) {
    // bỏ qua lỗi logout phía server
  } finally {
    clearAuthSession();
  }
}

export async function refreshCurrentUser() {
  try {
    const result = await apiRequest("/auth/me");
    saveAuthSession({ user: result.user });
    return sanitizeUser(result.user);
  } catch (_error) {
    clearAuthSession();
    return null;
  }
}

export function getCurrentUser() {
  if (typeof window === "undefined") return null;

  try {
    const saved = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!saved) return null;
    return sanitizeUser(JSON.parse(saved));
  } catch (_error) {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getCurrentUser());
}

export function hasRole(user, roles = []) {
  if (!user) return false;
  return roles.includes(user.role);
}

export function canAccessRoute(user, route) {
  if (!route?.roles || route.roles.length === 0) return true;
  return hasRole(user, route.roles);
}

export function canManageStructure(user) {
  return user?.role === "admin";
}

export function canAddAsset(user) {
  return Boolean(user) && ["admin", "cungtruong"].includes(user.role);
}

export function canEditAsset(user) {
  return canAddAsset(user);
}

export function canDeleteAsset(user) {
  return user?.role === "admin";
}

export function canViewAllBranches(user) {
  return user?.role === "admin";
}

export async function getAllUsers() {
  const result = await apiRequest("/users");
  return Array.isArray(result.data) ? result.data.map((item) => sanitizeUser(item)) : [];
}

export async function findUserAccount(username) {
  const normalizedUsername = String(username || "").trim();
  if (!normalizedUsername) return null;

  try {
    const result = await apiRequest(`/users/find?username=${encodeURIComponent(normalizedUsername)}`);
    return sanitizeUser(result.data);
  } catch (_error) {
    return null;
  }
}
export async function createUserAccount(payload = {}) {
  try {
    const result = await apiRequest("/users", {
      method: "POST",
      body: payload,
    });

    dispatchWindowEvent(USERS_UPDATED_EVENT);
    dispatchWindowEvent("t3h-systems-updated");

    return {
      success: true,
      message: result.message,
      user: sanitizeUser(result.user),
      password: result.password,
      addedStations: result.addedStations || [],
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Không thể tạo tài khoản.",
    };
  }
}

export async function resetUserPassword(username, nextPassword = "") {
  try {
    const result = await apiRequest(`/users/${encodeURIComponent(String(username || "").trim())}/reset-password`, {
      method: "POST",
      body: {
        nextPassword,
      },
    });

    dispatchWindowEvent(USERS_UPDATED_EVENT);
    dispatchWindowEvent("t3h-password-reset-requests-updated");

    return {
      success: true,
      message: result.message,
      password: result.password,
      user: sanitizeUser(result.user),
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Không thể cấp lại mật khẩu.",
    };
  }
}
