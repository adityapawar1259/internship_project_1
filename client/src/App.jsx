import React, { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Background,
  Controls,
} from "reactflow";
import "reactflow/dist/style.css";
import { io } from "socket.io-client";
import { nodeTypes } from "./nodes.jsx";
import { validate } from "./validate.js";
import Dashboard from "./Dashboard.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const DEFAULTS = {
  http: {
    label: "HTTP call",
    url: "https://httpbin.org/post",
    method: "POST",
    compensation: { type: "http", url: "https://httpbin.org/post" },
  },
  delay: { label: "Delay", ms: 500 },
  script: { label: "Transform", code: "({ doubled: (input.n || 1) * 2 })" },
  condition: { label: "Condition", expression: "(input.n || 0) > 5" },
};

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem("apiKey") || "");
  const [tab, setTab] = useState("builder");
  const [nodes, setNodes] = useState([
    {
      id: "start",
      type: "start",
      position: { x: 250, y: 20 },
      data: { label: "Start" },
    },
  ]);
  const [edges, setEdges] = useState([]);
  const [name, setName] = useState("My workflow");
  const [msgs, setMsgs] = useState([]);
  const [wfId, setWfId] = useState(null);
  const headers = { "content-type": "application/json", "x-api-key": apiKey };

  useEffect(() => {
    if (!apiKey) return;
    localStorage.setItem("apiKey", apiKey);
    const socket = io(API, { auth: { apiKey } });
    socket.on("trace", (ev) => {
      // live node tracing
      if (ev.type === "node")
        setNodes((ns) =>
          ns.map((n) =>
            n.id === ev.nodeId
              ? {
                  ...n,
                  data: { ...n.data, state: ev.state, attempts: ev.attempts },
                }
              : n,
          ),
        );
      setMsgs((m) => [
        ...m.slice(-50),
        `${ev.type} ${ev.nodeId || ""} ${ev.state}${ev.error ? " - " + ev.error : ""}`,
      ]);
    });
    return () => socket.close();
  }, [apiKey]);

  const onNodesChange = useCallback(
    (c) => setNodes((n) => applyNodeChanges(c, n)),
    [],
  );
  const onEdgesChange = useCallback(
    (c) => setEdges((e) => applyEdgeChanges(c, e)),
    [],
  );
  const onConnect = useCallback((c) => setEdges((e) => addEdge(c, e)), []);
  const addNode = (type) =>
    setNodes((n) => [
      ...n,
      {
        id: `${type}-${Date.now() % 100000}`,
        type,
        position: { x: 150 + Math.random() * 200, y: 120 + n.length * 70 },
        data: { ...DEFAULTS[type] },
      },
    ]);
  const errors = validate(nodes, edges);
  const graph = () => ({
    nodes: nodes.map(({ id, type, data }) => ({
      id,
      type,
      data: { ...data, state: undefined },
    })),
    edges: edges.map(({ id, source, target, sourceHandle }) => ({
      id,
      source,
      target,
      sourceHandle,
    })),
  });

  const save = async () => {
    const r = await fetch(`${API}/api/workflows`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name, graph: graph() }),
    });
    const j = await r.json();
    if (r.ok) {
      setWfId(j._id);
      setMsgs((m) => [...m, "Saved ✔"]);
    } else setMsgs((m) => [...m, "Rejected: " + (j.errors || []).join("; ")]);
  };
  const run = async () => {
    setNodes((ns) =>
      ns.map((n) => ({ ...n, data: { ...n.data, state: undefined } })),
    );
    await fetch(`${API}/api/workflows/${wfId}/run`, {
      method: "POST",
      headers,
      body: JSON.stringify({ input: { n: 7 } }),
    });
  };

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: 8,
          display: "flex",
          gap: 8,
          borderBottom: "1px solid #ccc",
          alignItems: "center",
        }}
      >
        <input
          placeholder="API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={{ width: 260 }}
        />
        <button onClick={() => setTab("builder")}>Builder</button>
        <button onClick={() => setTab("dashboard")}>Dashboard</button>
      </header>
      {tab === "dashboard" ? (
        <Dashboard api={API} headers={headers} />
      ) : (
        <div style={{ flex: 1, display: "flex" }}>
          <div style={{ flex: 1 }}>
            <div
              style={{ padding: 8, display: "flex", gap: 6, flexWrap: "wrap" }}
            >
              <input value={name} onChange={(e) => setName(e.target.value)} />
              {Object.keys(DEFAULTS).map((t) => (
                <button key={t} onClick={() => addNode(t)}>
                  + {t}
                </button>
              ))}
              <button disabled={errors.length > 0} onClick={save}>
                Save
              </button>
              <button disabled={!wfId} onClick={run}>
                Run
              </button>
            </div>
            {errors.length > 0 && (
              <div style={{ color: "#b91c1c", padding: "0 8px", fontSize: 12 }}>
                {errors.join(" • ")}
              </div>
            )}
            <div style={{ height: "calc(100% - 70px)" }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
              >
                <Background />
                <Controls />
              </ReactFlow>
            </div>
          </div>
          <aside
            style={{
              width: 280,
              borderLeft: "1px solid #ccc",
              padding: 8,
              overflow: "auto",
              fontFamily: "monospace",
              fontSize: 11,
            }}
          >
            <b>Live trace</b>
            {msgs.map((m, i) => (
              <div key={i}>{m}</div>
            ))}
          </aside>
        </div>
      )}
    </div>
  );
}
