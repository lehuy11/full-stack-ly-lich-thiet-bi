export const AUTH_TOKEN_STORAGE_KEY = "t3h_auth_token";
export const API_BASE_URL = String(process.env.REACT_APP_API_URL || "http://localhost:4000/api").replace(/\/$/, "");

function clearAuthStorage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("t3h_auth_user");
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export async function apiRequest(path, options = {}) {
  const { method = "GET", body, headers = {}, auth = true } = options;
  const requestHeaders = {
    Accept: "application/json",
    ...headers,
  };

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (auth && typeof window !== "undefined") {
    const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    const message = payload?.message || "Có lỗi khi gọi API.";

    if (response.status === 401) {
      clearAuthStorage();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("t3h-auth-expired"));
      }
    }

    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}
