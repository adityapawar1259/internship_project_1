import { io } from "socket.io-client";

// >>> Backend URL comes from client/.env  ->  VITE_API_URL=http://localhost:4000 <<<
export const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
export const getToken = () => localStorage.getItem("token") || "";
export const setToken = (t) =>
  t ? localStorage.setItem("token", t) : localStorage.removeItem("token");

let onUnauthorized = null; // App registers this so an expired login sends the user back to the login page
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

export async function api(path, { method = "GET", body, noAuth = false } = {}) {
  const token = noAuth ? "" : getToken();
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Cannot reach the API. Is the server running and VITE_API_URL correct?",
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
    const err = new Error(
      data.error ||
        (Array.isArray(data.errors) && data.errors.join("; ")) ||
        `Request failed (${res.status})`,
    );
    err.status = res.status;
    err.fields =
      data.errors && !Array.isArray(data.errors) ? data.errors : null; // per-field messages from the server
    throw err;
  }
  return data;
}

export const connectSocket = (token) => io(API, { auth: { token } });
export const fmtMs = (ms) =>
  ms == null ? "-" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
export const fmtTime = (d) => (d ? new Date(d).toLocaleString() : "-");
