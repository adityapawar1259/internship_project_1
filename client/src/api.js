import { io } from "socket.io-client";

// >>> Backend URL comes from client/.env  ->  VITE_API_URL=http://localhost:4000 <<<
export const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
export const getKey = () => localStorage.getItem("apiKey") || "";
export const setKey = (k) =>
  k ? localStorage.setItem("apiKey", k) : localStorage.removeItem("apiKey");

export async function api(
  path,
  { method = "GET", body, key, adminSecret } = {},
) {
  const res = await fetch(API + path, {
    method,
    headers: {
      "content-type": "application/json",
      "x-api-key": key ?? getKey(),
      ...(adminSecret ? { "x-admin-secret": adminSecret } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      data.error ||
        (data.errors && data.errors.join("; ")) ||
        `Request failed (${res.status})`,
    );
  return data;
}

export const connectSocket = (key) => io(API, { auth: { apiKey: key } });
export const fmtMs = (ms) =>
  ms == null ? "-" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
export const fmtTime = (d) => (d ? new Date(d).toLocaleString() : "-");
