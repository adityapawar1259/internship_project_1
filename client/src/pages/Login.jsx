import React, { useState } from "react";
import { api } from "../api.js";
import { strength, validateAuth } from "../authValidate.js";

const EMPTY = { name: "", email: "", password: "", confirm: "", workspace: "" };

export default function Login({ onSession, toast }) {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [f, setF] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [serverErr, setServerErr] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const errors = validateAuth(mode, f);
  const err = (k) =>
    touched[k] || touched.all ? errors[k] || serverErr[k] : "";
  const set = (k) => (e) => {
    setF({ ...f, [k]: e.target.value });
    setServerErr({ ...serverErr, [k]: undefined });
  };
  const blur = (k) => () => setTouched({ ...touched, [k]: true });
  const switchMode = (m) => {
    setMode(m);
    setTouched({});
    setServerErr({});
    setF({ ...EMPTY, email: f.email });
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setTouched({ all: true });
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      const body =
        mode === "login"
          ? { email: f.email.trim(), password: f.password }
          : {
              name: f.name.trim(),
              email: f.email.trim(),
              password: f.password,
              workspace: f.workspace.trim(),
            };
      const r = await api(`/api/auth/${mode}`, {
        method: "POST",
        body,
        noAuth: true,
      });
      await onSession(r.token);
      toast(
        mode === "login"
          ? `Welcome back, ${r.user.name}`
          : "Account created. Welcome to FlowForge!",
        "success",
      );
    } catch (e) {
      if (e.fields) setServerErr(e.fields);
      toast(e.message, "error");
    }
    setBusy(false);
  };

  const field = (k, label, type = "text", extra = {}) => (
    <div className="field">
      <label htmlFor={k}>{label}</label>
      <input
        id={k}
        className={`input ${err(k) ? "bad" : ""}`}
        type={type}
        value={f[k]}
        onChange={set(k)}
        onBlur={blur(k)}
        {...extra}
      />
      {err(k) && <div className="ferr">{err(k)}</div>}
    </div>
  );
  const s = strength(f.password);

  return (
    <div className="login">
      <div className="login-box narrow">
        <div className="title">
          <h1>⚙ FlowForge</h1>
          <div className="muted">Distributed workflow automation engine</div>
        </div>
        <div className="card">
          <div className="auth-tabs">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              Create account
            </button>
          </div>
          <form onSubmit={submit} noValidate>
            {mode === "register" &&
              field("name", "Your name", "text", {
                autoComplete: "name",
                placeholder: "Adity Sharma",
              })}
            {field("email", "Email", "email", {
              autoComplete: "email",
              placeholder: "you@company.com",
            })}
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="pw">
                <input
                  id="password"
                  className={`input ${err("password") ? "bad" : ""}`}
                  type={showPw ? "text" : "password"}
                  value={f.password}
                  onChange={set("password")}
                  onBlur={blur("password")}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder={
                    mode === "register"
                      ? "At least 8 characters, a letter and a number"
                      : ""
                  }
                />
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
              {err("password") && <div className="ferr">{err("password")}</div>}
              {mode === "register" && f.password && (
                <div className={`meter s${s}`}>
                  <div />
                  <div />
                  <div />
                  <div />
                </div>
              )}
            </div>
            {mode === "register" &&
              field(
                "confirm",
                "Confirm password",
                showPw ? "text" : "password",
                { autoComplete: "new-password" },
              )}
            {mode === "register" &&
              field("workspace", "Workspace name (optional)", "text", {
                placeholder: "Acme Inc",
              })}
            <button className="btn primary block" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
          <p className="muted small center" style={{ marginTop: 14 }}>
            {mode === "login" ? (
              <>
                New here?{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    switchMode("register");
                  }}
                >
                  Create an account
                </a>
              </>
            ) : (
              <>
                Already registered?{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    switchMode("login");
                  }}
                >
                  Sign in
                </a>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
