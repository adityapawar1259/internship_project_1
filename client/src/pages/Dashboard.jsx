import React, { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api.js";
import { useApp } from "../ctx.js";

export default function Dashboard() {
  const { toast } = useApp();
  const [m, setM] = useState(null);
  const [names, setNames] = useState({});
  const [dbo, setDbo] = useState(null);
  const load = () => {
    api("/api/metrics")
      .then(setM)
      .catch((e) => toast(e.message, "error"));
    api("/api/db/overview")
      .then(setDbo)
      .catch(() => {});
  };
  useEffect(() => {
    api("/api/workflows")
      .then((w) => setNames(Object.fromEntries(w.map((x) => [x._id, x.name]))))
      .catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  if (!m) return <div className="empty">Loading metrics…</div>;

  const sc = m.statusCounts || {};
  const total = Object.values(sc).reduce((a, b) => a + b, 0);
  const ok = sc.COMPLETED || 0;
  const bad = (sc.ROLLED_BACK || 0) + (sc.FAILED || 0);
  const pct = Math.min(100, (m.quota.used / m.quota.limit) * 100);
  const hours = [...Array(24).keys()];
  const wfs = [...new Set(m.heatmap.map((h) => h._id.workflowId))];
  const cell = (w, h) =>
    m.heatmap.find((x) => x._id.workflowId === w && x._id.hour === h)
      ?.failures || 0;
  const maxF = Math.max(1, ...m.heatmap.map((h) => h.failures));

  return (
    <>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <div className="label">Runs (24h)</div>
          <div className="value">{total}</div>
        </div>
        <div className="card stat">
          <div className="label">Success rate</div>
          <div className="value">
            {total ? Math.round((ok / total) * 100) : 0}%
          </div>
        </div>
        <div className="card stat">
          <div className="label">Failed / rolled back</div>
          <div
            className="value"
            style={{ color: bad ? "var(--bad)" : undefined }}
          >
            {bad}
          </div>
        </div>
        <div className="card stat">
          <div className="label">Monthly quota</div>
          <div className="value">
            {m.quota.used}
            <span className="muted small"> / {m.quota.limit}</span>
          </div>
          <div className={`progress ${pct > 80 ? "hot" : ""}`}>
            <div style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Execution latency by hour of day (ms)</h3>
        {m.latency.length === 0 ? (
          <div className="empty">
            No finished executions in the last 24 hours.
          </div>
        ) : (
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={m.latency}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="hour"
                  label={{
                    value: "hour (UTC)",
                    position: "insideBottom",
                    offset: -2,
                  }}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avg"
                  name="average"
                  stroke="#4f46e5"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="p95"
                  name="p95"
                  stroke="#dc2626"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {dbo && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>
            Database <span className="badge">{dbo.database}</span>{" "}
            <span
              className={`badge ${dbo.state === "connected" ? "COMPLETED" : "FAILED"}`}
            >
              {dbo.state}
            </span>
          </h3>
          <div className="dbgrid">
            {dbo.collections.map((c) => (
              <div key={c.name} className="dbcell">
                <div className="mono muted">{c.name}</div>
                <b>{c.documents}</b>
              </div>
            ))}
          </div>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Documents stored for your workspace. To browse the whole database
            run <code>npm run db:show</code> in the server folder.
          </p>
        </div>
      )}
      <div className="card">
        <h3>Failure heatmap (workflow × hour, last 24h)</h3>
        {wfs.length === 0 ? (
          <div className="empty">
            <div className="big">🎉</div>No failures in the last 24 hours.
          </div>
        ) : (
          <div
            className="heat"
            style={{ gridTemplateColumns: `140px repeat(24, 1fr)` }}
          >
            <div />
            {hours.map((h) => (
              <div key={h} className="muted" style={{ textAlign: "center" }}>
                {h}
              </div>
            ))}
            {wfs.map((w) => (
              <React.Fragment key={w}>
                <div title={w}>
                  <b>{names[w] || String(w).slice(-6)}</b>
                </div>
                {hours.map((h) => {
                  const n = cell(w, h);
                  return (
                    <div
                      key={h}
                      className="cell"
                      title={`${h}:00 → ${n} failure(s)`}
                      style={
                        n
                          ? {
                              background: `rgba(220,38,38,${0.25 + 0.75 * (n / maxF)})`,
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
