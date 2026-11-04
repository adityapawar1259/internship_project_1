// Instant form validation for the login / sign-up page (the server checks everything again).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function passwordIssue(pw) {
  if (!pw || pw.length < 8) return "At least 8 characters";
  if (pw.length > 128) return "At most 128 characters";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw))
    return "Needs a letter and a number";
  return "";
}

export function validateAuth(mode, f) {
  const e = {};
  const email = (f.email || "").trim();
  if (!email) e.email = "Email is required";
  else if (!EMAIL_RE.test(email)) e.email = "Enter a valid email address";
  if (mode === "login") {
    if (!f.password) e.password = "Password is required";
    return e;
  }
  const name = (f.name || "").trim();
  if (name.length < 2 || name.length > 60)
    e.name = "Name must be 2-60 characters";
  const pi = passwordIssue(f.password);
  if (pi) e.password = pi;
  if (f.confirm !== f.password) e.confirm = "Passwords do not match";
  const w = (f.workspace || "").trim();
  if (w && (w.length < 2 || w.length > 60))
    e.workspace = "Workspace name must be 2-60 characters";
  return e;
}

// 0-4 score for the little strength bar
export function strength(pw = "") {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
