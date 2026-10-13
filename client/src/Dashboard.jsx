import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard({ api, headers }) {
  const [m, setM] = useState(null);
  const load = () =>
    fetch(`${api}/api/metrics`, { headers })
      .then((r) => r.json())
      .then(setM)
      .catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  if (!m) return <p style={{ padding: 16 }}>Enter a valid API key…</p>;
  const pct = Math.min(100, (m.quota.used / m.quota.limit) * 100);
  const hours = [...Array(24).keys()];
  const wfs = [...new Set(m.heatmap.map((h) => h._id.workflowId))];
  const cell = (w, h) =>
    m.heatmap.find((x) => x._id.workflowId === w && x._id.hour === h)
      ?.failures || 0;
  return (
    <div style={{ padding: 16, overflow: "auto" }}>
      <h3>
        Quota: {m.quota.used} / {m.quota.limit}
      </h3>
      <div
        style={{ background: "#eee", height: 12, borderRadius: 6, width: 300 }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: 12,
            borderRadius: 6,
            background: pct > 80 ? "#ef4444" : "#22c55e",
          }}
        />
      </div>
      <h3>Execution latency by hour (ms)</h3>
      <div style={{ height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={m.latency}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line dataKey="avg" stroke="#3b82f6" name="avg" />
            <Line dataKey="p95" stroke="#ef4444" name="p95" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <h3>Failure heatmap (workflow × hour, last 24h)</h3>
      {wfs.length === 0 ? (
        <p>No failures 🎉</p>
      ) : (
        wfs.map((w) => (
          <div
            key={w}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              marginBottom: 2,
            }}
          >
            <code style={{ width: 80, fontSize: 10 }}>
              {String(w).slice(-6)}
            </code>
            {hours.map((h) => (
              <div
                key={h}
                title={`${h}:00 → ${cell(w, h)} failures`}
                style={{
                  width: 16,
                  height: 16,
                  background: `rgba(220,38,38,${Math.min(1, cell(w, h) / 5)})`,
                  border: "1px solid #eee",
                }}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
