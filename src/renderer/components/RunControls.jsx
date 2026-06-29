import React, { useCallback, useEffect, useState } from 'react';

// F7/F9/F10 / TF1 — run controls for the ACTIVE repo.
// Build & Start runs the repo's sequence (selfpointrest: optional UI builds → buildAll →
// npm start @3000; other repos: their own build → start). Stop tree-kills the process;
// Restart = stop → start. State + port + a live log stream are shown.
//
// The full status table + Stop all is TH1/TH2 — this panel only drives the active repo.
const STATE_COLORS = {
  running: '#107c10',
  building: '#7a4d00',
  starting: '#7a4d00',
  crashed: '#b00020',
  stopped: '#555',
};

export default function RunControls({ repo }) {
  const [status, setStatus] = useState(null);
  const [plan, setPlan] = useState(null); // describeRun() output (command preview)
  const [busy, setBusy] = useState(null); // 'start' | 'stop' | 'restart' | null
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [log, setLog] = useState('');
  // selfpointrest-only: which UIs to build before buildAll.
  const [buildUIs, setBuildUIs] = useState({ backend: false, kikar: false, prutah: false });

  const isSelfpointrest = repo && repo.id === 'selfpointrest';
  const buildOnly = repo ? repo.buildOnly : false;

  const loadStatus = useCallback(
    async (active = true) => {
      if (!repo) return;
      try {
        const res = await window.launcher.runner.status(repo.id);
        if (active) setStatus(res);
      } catch (err) {
        if (active) setError(String(err));
      }
    },
    [repo]
  );

  // Refresh status + command preview whenever the active repo (or selected UIs) changes.
  useEffect(() => {
    let active = true;
    setError(null);
    setResult(null);
    setLog('');
    loadStatus(active);
    if (repo) {
      window.launcher.runner
        .describe(repo.id, isSelfpointrest ? { buildUIs } : {})
        .then((res) => {
          if (active) setPlan(res);
        })
        .catch(() => {
          if (active) setPlan(null);
        });
    }
    return () => {
      active = false;
    };
  }, [repo, loadStatus, isSelfpointrest, buildUIs]);

  // Subscribe to the live log stream for this repo.
  useEffect(() => {
    if (!repo) return undefined;
    return window.launcher.runner.onLog((entry) => {
      if (!entry || entry.repoId !== repo.id) return;
      setLog((prev) => `${prev}${entry.text || ''}`.slice(-24000));
    });
  }, [repo]);

  // Poll status while a process is alive so a crash/exit is reflected without a manual refresh.
  useEffect(() => {
    if (!repo) return undefined;
    const id = setInterval(() => loadStatus(true), 1500);
    return () => clearInterval(id);
  }, [repo, loadStatus]);

  if (!repo) {
    return (
      <section style={styles.panel}>
        <p style={{ margin: 0, color: '#666' }}>Chon mot repo de chay (build/start).</p>
      </section>
    );
  }

  const state = status ? status.state : 'stopped';
  const running = state === 'running' || state === 'building' || state === 'starting';

  async function onStart() {
    setBusy('start');
    setError(null);
    setResult(null);
    setLog('');
    try {
      const options = isSelfpointrest ? { buildUIs } : {};
      const res = await window.launcher.runner.start(repo.id, options);
      setResult(res);
      if (res && res.status) setStatus(res.status);
      await loadStatus(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  async function onStop() {
    setBusy('stop');
    setError(null);
    setResult(null);
    try {
      const res = await window.launcher.runner.stop(repo.id);
      setResult(res);
      if (res && res.status) setStatus(res.status);
      await loadStatus(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  async function onRestart() {
    setBusy('restart');
    setError(null);
    setResult(null);
    setLog('');
    try {
      const options = isSelfpointrest ? { buildUIs } : {};
      const res = await window.launcher.runner.restart(repo.id, options);
      setResult(res);
      if (res && res.status) setStatus(res.status);
      await loadStatus(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  function toggleUI(key) {
    setBuildUIs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const anyBusy = busy !== null;

  return (
    <section style={styles.panel}>
      <h3 style={{ margin: '0 0 0.5rem' }}>
        Run - <code>{repo.name}</code>
      </h3>

      {error && <p style={styles.error}>Loi: {error}</p>}

      <p style={{ margin: '0 0 0.5rem' }}>
        State:{' '}
        <strong style={{ color: STATE_COLORS[state] || '#555' }}>{state}</strong>
        {status && status.pid != null ? <span style={styles.meta}> - pid {status.pid}</span> : null}
        {' - '}
        port {status && status.port != null ? status.port : repo.port == null ? 'n/a' : repo.port}
        {status && status.step ? <span style={styles.meta}> - step: {status.step}</span> : null}
      </p>

      {buildOnly && (
        <div style={styles.note}>
          <code>{repo.name}</code> la build-only — duoc selfpointrest serve o{' '}
          <code>{repo.servedBy ? repo.servedBy.route : '/'}</code>. Khong co start rieng.
        </div>
      )}

      {isSelfpointrest && (
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Build UIs truoc khi start (tuy chon)</legend>
          {[
            { key: 'backend', label: 'build-backend (/backend)' },
            { key: 'kikar', label: 'build-kikar (/kikar)' },
            { key: 'prutah', label: 'build-prutah (/prutah)' },
          ].map((ui) => (
            <label key={ui.key} style={styles.checkRow}>
              <input
                type="checkbox"
                checked={buildUIs[ui.key]}
                onChange={() => toggleUI(ui.key)}
                disabled={anyBusy}
              />
              {ui.label}
            </label>
          ))}
        </fieldset>
      )}

      {plan && plan.ok && plan.steps && plan.steps.length > 0 && (
        <details style={styles.details}>
          <summary>Command sequence ({plan.steps.length}) - cwd {plan.cwd}</summary>
          <ol style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
            {plan.steps.map((s, i) => (
              <li key={`${s.label}-${i}`} style={{ fontSize: '0.8rem' }}>
                <code>{s.command}</code>
                {s.longRunning ? ' (long-running)' : ''}
              </li>
            ))}
          </ol>
        </details>
      )}

      <div style={styles.row}>
        <button type="button" onClick={onStart} disabled={anyBusy || running || buildOnly}>
          {busy === 'start' ? 'Starting...' : 'Build & Start'}
        </button>
        <button type="button" onClick={onStop} disabled={anyBusy || !running}>
          {busy === 'stop' ? 'Stopping...' : 'Stop'}
        </button>
        <button type="button" onClick={onRestart} disabled={anyBusy || buildOnly}>
          {busy === 'restart' ? 'Restarting...' : 'Restart'}
        </button>
      </div>

      {result && (
        <div style={result.ok ? styles.notice : styles.error}>
          <strong>{result.ok ? 'OK' : 'Failed'}:</strong> {result.message}
        </div>
      )}

      <pre style={styles.log}>{log || 'Run output will stream here.'}</pre>
    </section>
  );
}

const styles = {
  panel: {
    border: '1px solid #ddd',
    borderRadius: 6,
    padding: '0.75rem 1rem',
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    alignItems: 'center',
    marginBottom: '0.6rem',
  },
  meta: {
    color: '#555',
    fontSize: '0.85rem',
  },
  fieldset: {
    border: '1px solid #ddd',
    borderRadius: 4,
    margin: '0 0 0.6rem',
    padding: '0.4rem 0.6rem',
  },
  legend: {
    fontSize: '0.8rem',
    color: '#555',
    padding: '0 0.3rem',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.85rem',
    marginBottom: '0.2rem',
  },
  details: {
    margin: '0 0 0.6rem',
    fontSize: '0.85rem',
    color: '#444',
    overflowWrap: 'anywhere',
  },
  note: {
    color: '#3a3a6a',
    background: '#eef1fb',
    border: '1px solid #c9d2f0',
    padding: '0.5rem 0.6rem',
    borderRadius: 4,
    margin: '0 0 0.6rem',
    fontSize: '0.85rem',
    overflowWrap: 'anywhere',
  },
  error: {
    color: '#b00020',
    background: '#fde7e9',
    padding: '0.45rem 0.6rem',
    borderRadius: 4,
    margin: '0 0 0.6rem',
    overflowWrap: 'anywhere',
  },
  notice: {
    color: '#107c10',
    background: '#edf7ed',
    padding: '0.45rem 0.6rem',
    borderRadius: 4,
    margin: '0 0 0.6rem',
    overflowWrap: 'anywhere',
  },
  log: {
    background: '#111',
    color: '#f3f3f3',
    borderRadius: 4,
    padding: '0.6rem',
    margin: 0,
    minHeight: 120,
    maxHeight: 220,
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    fontSize: '0.8rem',
  },
};
