import { apiRequest } from "./api";

export const NOTIFICATIONS_UPDATED_EVENT = "t3h-notifications-updated";

function dispatchUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
  }
}

export function formatNotificationTime(value) {
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

export async function loadNotifications() {
  const result = await apiRequest("/notifications");
  return Array.isArray(result.data) ? result.data : [];
}

export async function addNotification(notification) {
  const entry = {
    type: notification?.type || "info",
    title: notification?.title || "Thông báo hệ thống",
    message: notification?.message || "",
    branchName: notification?.branchName || "",
    stationName: notification?.stationName || "",
    categoryName: notification?.categoryName || "",
    assetName: notification?.assetName || "",
    assetCode: notification?.assetCode || "",
    actorName: notification?.actorName || "",
    actorUsername: notification?.actorUsername || "",
    createdAt: notification?.createdAt || new Date().toISOString(),
  };

  await apiRequest("/notifications", {
    method: "POST",
    body: entry,
  });
  dispatchUpdated();
  return entry;
}

export async function logAssetCreated({
  branchName,
  stationName,
  categoryName,
  assetName,
  assetCode,
  actorName,
  actorUsername,
  createdAt,
}) {
  const branchPart = branchName ? `Cung ${branchName.replace(/^Cung\s+/i, "")}` : "";
  const stationPart = stationName ? `ga ${stationName.replace(/^Hệ thống\s+TTTH\s+ga\s+/i, "")}` : "";
  const location = [branchPart, stationPart].filter(Boolean).join(" - ");

  return addNotification({
    type: "asset-created",
    title: "Thêm chi tiết tài sản mới",
    message: [
      actorName ? `${actorName} vừa thêm chi tiết tài sản` : "Vừa thêm chi tiết tài sản",
      assetName ? `\"${assetName}\"` : "mới",
      location ? `tại ${location}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    branchName,
    stationName,
    categoryName,
    assetName,
    assetCode,
    actorName,
    actorUsername,
    createdAt,
  });
}

export async function logAssetDeleted({
  branchName,
  stationName,
  categoryName,
  assetName,
  assetCode,
  actorName,
  actorUsername,
  createdAt,
}) {
  const branchPart = branchName ? `Cung ${branchName.replace(/^Cung\s+/i, "")}` : "";
  const stationPart = stationName ? `ga ${stationName.replace(/^Hệ thống\s+TTTH\s+ga\s+/i, "")}` : "";
  const location = [branchPart, stationPart].filter(Boolean).join(" - ");

  return addNotification({
    type: "asset-deleted",
    title: "Xóa chi tiết tài sản",
    message: [
      actorName ? `${actorName} vừa xóa chi tiết tài sản` : "Vừa xóa chi tiết tài sản",
      assetName ? `\"${assetName}\"` : "",
      location ? `tại ${location}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    branchName,
    stationName,
    categoryName,
    assetName,
    assetCode,
    actorName,
    actorUsername,
    createdAt,
  });
}

export async function logPasswordResetRequested({
  branchName,
  actorName,
  actorUsername,
  createdAt,
}) {
  return addNotification({
    type: "password-reset-request",
    title: "Yêu cầu quên mật khẩu",
    message: [actorName ? `${actorName}` : actorUsername || "Người dùng", "vừa gửi yêu cầu quên mật khẩu."]
      .filter(Boolean)
      .join(" "),
    branchName,
    actorName,
    actorUsername,
    createdAt,
  });
}

export async function clearNotifications() {
  await apiRequest("/notifications", {
    method: "DELETE",
  });
  dispatchUpdated();
}

export async function getRecentNotifications(limit = 50) {
  const items = await loadNotifications();
  return items.slice(0, limit);
}
