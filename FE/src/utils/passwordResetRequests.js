import { apiRequest } from "./api";

export const PASSWORD_RESET_REQUESTS_UPDATED_EVENT = "t3h-password-reset-requests-updated";

function dispatchUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PASSWORD_RESET_REQUESTS_UPDATED_EVENT));
  }
}

function normalizeRequest(request = {}) {
  return {
    id: request.id,
    username: String(request.username || "").trim(),
    displayName: String(request.displayName || request.display_name || request.username || "").trim(),
    branch: request.branch || request.branch_name || null,
    requestedAt: request.requestedAt || request.requested_at || null,
    status: request.status === "resolved" ? "resolved" : "pending",
    resolvedAt: request.resolvedAt || request.resolved_at || null,
    resolvedBy: request.resolvedBy || request.resolved_by || "",
  };
}

export function formatPasswordResetTime(value) {
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

export async function loadPasswordResetRequests(status = "") {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
  const result = await apiRequest(`/password-reset-requests${suffix}`);
  return Array.isArray(result.data) ? result.data.map(normalizeRequest) : [];
}

export async function getPendingPasswordResetRequests() {
  return loadPasswordResetRequests("pending");
}

export async function getPendingPasswordResetCount() {
  const items = await getPendingPasswordResetRequests();
  return items.length;
}

export async function getPendingPasswordResetByUsername(username) {
  const normalizedUsername = String(username || "").trim();
  if (!normalizedUsername) return null;

  const items = await getPendingPasswordResetRequests();
  return items.find((item) => item.username === normalizedUsername) || null;
}

export async function createPasswordResetRequest(payload = {}) {
  try {
    const result = await apiRequest("/password-reset-requests", {
      method: "POST",
      body: {
        username: payload.username,
      },
      auth: false,
    });

    dispatchUpdated();

    return {
      success: true,
      created: Boolean(result.created),
      message: result.message || "Nếu tên đăng nhập tồn tại, yêu cầu quên mật khẩu đã được ghi nhận.",
      request: result.request ? normalizeRequest(result.request) : null,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || "Không gửi được yêu cầu quên mật khẩu.",
    };
  }
}
export async function resolvePasswordResetRequest(username) {
  const normalizedUsername = String(username || "").trim();
  if (!normalizedUsername) return null;

  try {
    const result = await apiRequest(`/password-reset-requests/${encodeURIComponent(normalizedUsername)}/resolve`, {
      method: "PATCH",
    });
    dispatchUpdated();
    return normalizeRequest(result.request);
  } catch (_error) {
    return null;
  }
}
