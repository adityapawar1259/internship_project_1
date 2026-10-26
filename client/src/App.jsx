import React, { useCallback, useEffect, useState } from 'react';
import { AppCtx } from './ctx.js';
import { api, connectSocket, getKey, setKey, API } from './api.js';
import Login from './pages/Login.jsx';
import Builder from './pages/Builder.jsx';
import Workflows from './pages/Workflows.jsx';
import Executions from './pages/Executions.jsx';
import Dlq from './pages/Dlq.jsx';
import Dashboard from './pages/Dashboard.jsx';

const NAV = [
  ['builder', '🧩', 'Builder'], ['workflows', '📚', 'Workflows'], ['executions', '⚡', 'Executions'],
  ['dlq', '📮', 'Dead letters'], ['dashboard', '📊', 'Dashboard'],
];
const TITLES = { builder: 'Workflow builder', workflows: 'My workflows', executions: 'Executions', dlq: 'Dead-letter queue', dashboard: 'Admin dashboard' };

export default function App() {
  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(!!getKey());
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [page, setPage] = useState('builder');
  const [editId, setEditId] = useState(null);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((text, kind = 'info') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const login = useCallback(async (key) => {
    const info = await api('/api/me', { key });   // throws if the key is wrong
    setKey(key); setMe(info); return info;
  }, []);
  const logout = () => { setKey(''); setMe(null); socket?.close(); setSocket(null); };

  useEffect(() => { // auto-login with the saved key
    if (!getKey()) return;
    login(getKey()).catch(() => setKey('')).finally(() => setChecking(false));
  }, [login]);

  useEffect(() => { // one live WebSocket connection for the whole app
    if (!me) return;
    const s = connectSocket(getKey());
    s.on('connect', () => setConnected(true)); s.on('disconnect', () => setConnected(false));
    setSocket(s);
    return () => s.close();
  }, [me?.id]);

  const refreshMe = () => api('/api/me').then(setMe).catch(() => {});
  const openBuilder = (id = null) => { setEditId(id); setPage('builder'); };

  if (checking) return <div className="login"><div className="muted">Loading…</div></div>;
  if (!me) return <><Login onLogin={login} toast={toast} /><Toasts items={toasts} /></>;

  const ctx = { me, socket, toast, refreshMe, openBuilder, setPage };
  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
        <aside className="sidebar">
          <div className="brand"><div className="logo">⚙</div><span>FlowForge</span></div>
          <nav className="nav">
            {NAV.map(([id, icon, label]) => (
              <button key={id} className={page === id ? 'active' : ''} onClick={() => (id === 'builder' ? openBuilder(null) : setPage(id))}>
                <span>{icon}</span><span className="lbl">{label}</span>
              </button>))}
          </nav>
          <div className="side-foot">
            <b>{me.name}</b>
            <div>{me.usedThisMonth}/{me.monthlyQuota} runs this month</div>
            <button className="btn sm" style={{ marginTop: 8 }} onClick={logout}>Sign out</button>
          </div>
        </aside>
        <div className="main">
          <div className="topbar">
            <h2>{TITLES[page]}</h2>
            <span className="muted small"><span className={`dot ${connected ? 'on' : ''}`} />{connected ? 'Live connection' : 'Connecting…'} · {API}</span>
          </div>
          <div className={`content ${page === 'builder' ? 'fill' : ''}`}>
            {page === 'builder' && <Builder key={editId || 'new'} workflowId={editId} />}
            {page === 'workflows' && <Workflows />}
            {page === 'executions' && <Executions />}
            {page === 'dlq' && <Dlq />}
            {page === 'dashboard' && <Dashboard />}
          </div>
        </div>
      </div>
      <Toasts items={toasts} />
    </AppCtx.Provider>
  );
}
const Toasts = ({ items }) => <div className="toasts">{items.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div>;
