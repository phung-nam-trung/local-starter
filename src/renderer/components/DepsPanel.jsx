import React, { useCallback, useEffect, useState } from 'react';

export default function DepsPanel({ repo }) {
  const [statusResult, setStatusResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [log, setLog] = useState('');

  const loadStatus = useCallback(async () => {
    if (!repo) return;
    setError(null);
    try {
      const res = await window.launcher.deps.getStatus(repo.id);
      setStatusResult(res);
    } catch (err) {
      setError(String(err));
    }
  }, [repo]);

  useEffect(() => {
    setStatusResult(null);
    setResult(null);
    setError(null);
    setLog('');
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!repo) return undefined;
    return window.launcher.deps.onLog((entry) => {
      if (!entry || entry.repoId !== repo.id) return;
      setLog((prev) => `${prev}${entry.text || ''}`.slice(-24000));
    });
  }, [repo]);

  if (!repo) {
    return (
      <section style={styles.panel}>
        <p style={{ margin: 0, color: '#666' }}>
          Chon mot repo de kiem tra dependencies.
        </p>
      </section>
    );
  }

  const status = statusResult && statusResult.ok ? statusResult.status : null;

  async function runInstall(force) {
    setBusy(true);
    setError(null);
    setResult(null);
    setLog('');
    try {
      const res = await window.launcher.deps.install(repo.id, { force });
      setResult(res);
      await loadStatus();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={styles.panel}>
      <h3 style={{ margin: '0 0 0.5rem' }}>
        Dependencies - <code>{repo.name}</code>
      </h3>

      {error && <p style={styles.error}>Loi: {error}</p>}
      {statusResult && !statusResult.ok && <p style={styles.error}>{statusResult.message}</p>}

      <p style={{ margin: '0 0 0.5rem' }}>
        Status:{' '}
        {status ? (
          <>
            <strong>{status.needed ? 'install needed' : 'current'}</strong>
            {' - '}
            <span>{status.message}</span>
          </>
        ) : (
          '...'
        )}
      </p>

      <p style={styles.meta}>
        Command: <code>{repo.packageManager} install</code>
        {' - '}
        cwd: <code>{repo.installCwd}</code>
      </p>

      <div style={styles.row}>
        <button type="button" onClick={loadStatus} disabled={busy}>
          Check deps
        </button>
        <button type="button" onClick={() => runInstall(false)} disabled={busy}>
          {busy ? 'Installing...' : 'Install if needed'}
        </button>
        <button type="button" onClick={() => runInstall(true)} disabled={busy}>
          Force reinstall
        </button>
      </div>

      {result && (
        <div style={result.ok ? styles.notice : styles.error}>
          <strong>{result.ok ? 'OK' : 'Failed'}:</strong> {result.message}
          {result.hint ? (
            <>
              <br />
              {result.hint}
            </>
          ) : null}
        </div>
      )}

      <pre style={styles.log}>{log || 'Install output will stream here.'}</pre>
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
    margin: '0 0 0.6rem',
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
