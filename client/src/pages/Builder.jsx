import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
} from "reactflow";
import { api } from "../api.js";
import { useApp } from "../ctx.js";
import { nodeTypes, DEFAULTS, META } from "../components/nodes.jsx";
import NodeConfig from "../components/NodeConfig.jsx";
import { validate } from "../validate.js";

const START = [
  {
    id: "start",
    type: "start",
    position: { x: 260, y: 30 },
    data: { ...DEFAULTS.start },
  },
];
const fresh = (ns) =>
  ns.map((n) => ({
    ...n,
    data: { ...n.data, state: undefined, attempts: undefined },
  }));

export default function Builder({ workflowId }) {
  const { socket, toast, openBuilder, refreshMe } = useApp();
  const [id, setId] = useState(workflowId);
  const [name, setName] = useState("My workflow");
  const [trigger, setTrigger] = useState("");
  const [nodes, setNodes] = useState(START);
  const [edges, setEdges] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("config");
  const [trace, setTrace] = useState([]);
  const [runInput, setRunInput] = useState('{"n": 7}');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // load an existing workflow when editing
    if (!workflowId) return;
    api(`/api/workflows/${workflowId}`)
      .then((wf) => {
        setName(wf.name);
        setTrigger(wf.trigger?.event || "");
        setNodes(
          wf.graph.nodes.map((n, i) => ({
            ...n,
            position: n.position || { x: 260, y: 30 + i * 110 },
          })),
        );
        setEdges(wf.graph.edges);
      })
      .catch((e) => toast(e.message, "error"));
  }, [workflowId]);

  useEffect(() => {
    // live node tracing over WebSocket
    if (!socket) return;
    const onTrace = (ev) => {
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
      if (
        ev.type === "execution" &&
        ["COMPLETED", "ROLLED_BACK"].includes(ev.state)
      ) {
        toast(
          ev.state === "COMPLETED"
            ? "Execution completed ✔"
            : `Execution rolled back: ${ev.error || ""}`,
          ev.state === "COMPLETED" ? "success" : "error",
        );
        refreshMe();
      }
      setTrace((t) =>
        [
          { ...ev, at: new Date().toLocaleTimeString(), k: Math.random() },
          ...t,
        ].slice(0, 80),
      );
    };
    socket.on("trace", onTrace);
    return () => socket.off("trace", onTrace);
  }, [socket]);

  const onNodesChange = useCallback(
    (c) => setNodes((n) => applyNodeChanges(c, n)),
    [],
  );
  const onEdgesChange = useCallback(
    (c) => setEdges((e) => applyEdgeChanges(c, e)),
    [],
  );
  const onConnect = useCallback(
    (c) => setEdges((e) => addEdge({ ...c, animated: true }, e)),
    [],
  );
  const addNode = (type) => {
    const nid = `${type}_${Date.now().toString(36).slice(-4)}`;
    setNodes((ns) => [
      ...ns,
      {
        id: nid,
        type,
        position: { x: 120 + Math.random() * 280, y: 140 + ns.length * 80 },
        data: JSON.parse(JSON.stringify(DEFAULTS[type])),
      },
    ]);
    setSelected(nid);
    setTab("config");
  };
  const sel = nodes.find((n) => n.id === selected);
  const patch = (p) =>
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selected ? { ...n, data: { ...n.data, ...p } } : n,
      ),
    );
  const del = () => {
    setNodes((ns) => ns.filter((n) => n.id !== selected));
    setEdges((es) =>
      es.filter((e) => e.source !== selected && e.target !== selected),
    );
    setSelected(null);
  };
  const errors = useMemo(() => validate(nodes, edges), [nodes, edges]);

  const graph = () => ({
    nodes: nodes.map(({ id: nid, type, position, data }) => ({
      id: nid,
      type,
      position,
      data: { ...data, state: undefined, attempts: undefined },
    })),
    edges: edges.map(({ id: eid, source, target, sourceHandle }) => ({
      id: eid,
      source,
      target,
      sourceHandle,
    })),
  });
  const save = async () => {
    const body = {
      name,
      graph: graph(),
      trigger: trigger ? { event: trigger } : undefined,
    };
    const wf = id
      ? await api(`/api/workflows/${id}`, { method: "PUT", body })
      : await api("/api/workflows", { method: "POST", body });
    setId(wf._id);
    return wf._id;
  };
  const onSave = async () => {
    setBusy(true);
    try {
      await save();
      toast("Workflow saved", "success");
    } catch (e) {
      toast(e.message, "error");
    }
    setBusy(false);
  };
  const onRun = async () => {
    let input;
    try {
      input = JSON.parse(runInput || "{}");
    } catch {
      return toast("Run input is not valid JSON", "error");
    }
    setBusy(true);
    try {
      const wid = await save();
      setNodes((ns) => fresh(ns));
      setTab("trace");
      setTrace([]);
      await api(`/api/workflows/${wid}/run`, {
        method: "POST",
        body: { input },
      });
      toast("Execution started");
    } catch (e) {
      toast(e.message, "error");
    }
    setBusy(false);
  };

  return (
    <div className="builder">
      <div className="builder-main">
        <div className="toolbar">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workflow name"
          />
          <input
            className="input"
            style={{ width: 150 }}
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="Trigger event (opt.)"
            title="e.g. order.created — POST /api/events with this type starts the workflow"
          />
          <span className="sep" />
          {Object.keys(META)
            .filter((t) => t !== "start")
            .map((t) => (
              <button key={t} className="btn sm" onClick={() => addNode(t)}>
                {META[t].icon} {META[t].title}
              </button>
            ))}
          <span className="sep" />
          <input
            className="input mono"
            style={{ width: 130 }}
            value={runInput}
            onChange={(e) => setRunInput(e.target.value)}
            title="JSON input passed to the workflow as `input`"
          />
          <button
            className="btn"
            disabled={busy || errors.length > 0}
            onClick={onSave}
          >
            💾 Save
          </button>
          <button
            className="btn primary"
            disabled={busy || errors.length > 0}
            onClick={onRun}
          >
            ▶ Save &amp; Run
          </button>
          {id && (
            <button className="btn" onClick={() => openBuilder(null)}>
              ＋ New
            </button>
          )}
        </div>
        {errors.length > 0 ? (
          <div className="errors">⚠ {errors.join("  •  ")}</div>
        ) : (
          <div className="okbar">✔ Workflow is valid</div>
        )}
        <div className="canvas">
          <ReactFlow
            nodes={nodes.map((n) => ({ ...n, selected: n.id === selected }))}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => {
              setSelected(n.id);
              setTab("config");
            }}
            onPaneClick={() => setSelected(null)}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background gap={18} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      </div>
      <aside className="panel">
        <div className="tabs">
          <button
            className={tab === "config" ? "active" : ""}
            onClick={() => setTab("config")}
          >
            Node settings
          </button>
          <button
            className={tab === "trace" ? "active" : ""}
            onClick={() => setTab("trace")}
          >
            Live trace
          </button>
        </div>
        <div className="panel-body">
          {tab === "config" &&
            (sel ? (
              <NodeConfig node={sel} onChange={patch} onDelete={del} />
            ) : (
              <div className="empty">
                <div className="big">👆</div>Click a node to edit it.
                <br />
                Add steps with the buttons above, then drag from the dot at the
                bottom of one node to the dot at the top of the next.
              </div>
            ))}
          {tab === "trace" && (
            <>
              <div className="legend">
                <span>
                  <span className="badge RUNNING">RUNNING</span>
                </span>
                <span>
                  <span className="badge COMPLETED">DONE</span>
                </span>
                <span>
                  <span className="badge RETRYING">RETRYING</span>
                </span>
                <span>
                  <span className="badge FAILED">FAILED</span>
                </span>
              </div>
              {trace.length === 0 ? (
                <div className="empty">
                  Press “Save &amp; Run” to watch the nodes execute live.
                </div>
              ) : (
                trace.map((t) => (
                  <div className="trace-line" key={t.k}>
                    <span className="muted mono">{t.at}</span>
                    {t.type === "node" ? <b>{t.nodeId}</b> : <b>execution</b>}
                    <span className={`badge ${t.state}`}>{t.state}</span>
                    {t.error && <span className="muted">{t.error}</span>}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
