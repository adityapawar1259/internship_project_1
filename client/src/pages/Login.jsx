import React, { useState } from "react";
import { api } from "../api.js";

export default function Login({ onLogin, toast }) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);

  const connect = async (k) => {
    setBusy(true);
    try {
      await onLogin(k.trim());
    } catch (e) {
      toast(
        e.message === "Failed to fetch"
          ? "Cannot reach the API. Is the server running and VITE_API_URL correct?"
          : e.message,
        "error",
      );
    }
    setBusy(false);
  };
  const create = async () => {
    setBusy(true);
    try {
      setCreated(
        await api("/api/tenants", {
          method: "POST",
          key: "",
          adminSecret: secret,
          body: { name, monthlyQuota: 10000 },
        }),
      );
    } catch (e) {
      toast(
        e.message === "Failed to fetch"
          ? "Cannot reach the API. Is the server running?"
          : e.message,
        "error",
      );
    }
    setBusy(false);
  };

  return (
    <div className="login">
      <div className="login-box">
        <div className="title">
          <h1>⚙ Workflow Engine</h1>
          <div className="muted">Distributed workflow automation engine</div>
        </div>
        <div className="grid g2">
          <div className="card">
            <h3>I already have an API key</h3>
            <div className="field">
              <label>API key</label>
              <input
                className="input"
                placeholder="wf_..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && key && connect(key)}
              />
            </div>
            <button
              className="btn primary"
              disabled={!key || busy}
              onClick={() => connect(key)}
            >
              Connect
            </button>
          </div>
          <div className="card">
            <h3>Create a new workspace (tenant)</h3>
            {!created ? (
              <>
                <div className="field">
                  <label>Workspace name</label>
                  <input
                    className="input"
                    placeholder="Acme Inc"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Admin secret (ADMIN_SECRET from your .env)</label>
                  <input
                    className="input"
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                  />
                </div>
                <button
                  className="btn primary"
                  disabled={!name || !secret || busy}
                  onClick={create}
                >
                  Create workspace
                </button>
              </>
            ) : (
              <>
                <p className="small muted">
                  Workspace created. Copy your API key now — it is shown only
                  once.
                </p>
                <div className="keybox mono">{created.apiKey}</div>
                <div className="row">
                  <button
                    className="btn"
                    onClick={() => {
                      navigator.clipboard?.writeText(created.apiKey);
                      toast("Copied", "success");
                    }}
                  >
                    Copy
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => connect(created.apiKey)}
                  >
                    Continue →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
