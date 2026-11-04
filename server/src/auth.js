import crypto from "node:crypto";
import { promisify } from "node:util";
import { config } from "./config.js";

const scrypt = promisify(crypto.scrypt);

// ---------- password hashing (scrypt + random salt, no extra dependency)
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}
export async function verifyPassword(password, stored) {
  const [saltHex, keyHex] = String(stored || "").split(":");
  if (!saltHex || !keyHex) return false;
  const key = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(keyHex, "hex");
  return (
    expected.length === key.length && crypto.timingSafeEqual(expected, key)
  );
}
export const DUMMY_HASH = `${"00".repeat(16)}:${"00".repeat(64)}`; // used to keep login timing equal for unknown emails

// ---------- JWT (HS256)
const b64 = (v) => Buffer.from(v).toString("base64url");
const sign = (data, secret) =>
  crypto.createHmac("sha256", secret).update(data).digest();

export function signToken(
  payload,
  { ttlSec = config.jwtTtlSec, secret = config.jwtSecret } = {},
) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + ttlSec,
    jti: crypto.randomUUID(),
  };
  const data = `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(JSON.stringify(body))}`;
  return `${data}.${sign(data, secret).toString("base64url")}`;
}
export function verifyToken(token, { secret = config.jwtSecret } = {}) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const expected = sign(`${parts[0]}.${parts[1]}`, secret);
  const got = Buffer.from(parts[2], "base64url");
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected))
    return null;
  try {
    const body = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    return body.exp && body.exp > Date.now() / 1000 ? body : null;
  } catch {
    return null;
  }
}

// ---------- input validation (mirrored in client/src/authValidate.js)
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const normEmail = (e) =>
  String(e || "")
    .trim()
    .toLowerCase();

export function validatePassword(pw) {
  if (typeof pw !== "string" || pw.length < 8)
    return "Password must be at least 8 characters";
  if (pw.length > 128) return "Password must be at most 128 characters";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw))
    return "Password needs at least one letter and one number";
  return null;
}
export function validateRegister({ name, email, password, workspace } = {}) {
  const errors = {};
  const n = String(name || "").trim();
  if (n.length < 2 || n.length > 60)
    errors.name = "Name must be 2-60 characters";
  const e = normEmail(email);
  if (!e) errors.email = "Email is required";
  else if (e.length > 254 || !EMAIL_RE.test(e))
    errors.email = "Enter a valid email address";
  const pe = validatePassword(password);
  if (pe) errors.password = pe;
  const w = String(workspace || "").trim();
  if (w && (w.length < 2 || w.length > 60))
    errors.workspace = "Workspace name must be 2-60 characters";
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    clean: { name: n, email: e, password, workspace: w || `${n}'s workspace` },
  };
}
export function validateLogin({ email, password } = {}) {
  const errors = {};
  const e = normEmail(email);
  if (!e || !EMAIL_RE.test(e)) errors.email = "Enter a valid email address";
  if (typeof password !== "string" || !password)
    errors.password = "Password is required";
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    clean: { email: e, password },
  };
}
