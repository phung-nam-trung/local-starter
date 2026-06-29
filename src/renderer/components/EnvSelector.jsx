import React, { useEffect, useState } from 'react';

const CHOICES = [
  { id: 'prod', label: 'prod' },
  { id: 'test', label: 'test' },
];

export default function EnvSelector() {
  const [selectedEnv, setSelectedEnv] = useState('prod');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function loadStatus(active = true) {
    try {
      const res = await window.launcher.env.getStatus();
      if (!active) return;
      setStatus(res);
    } catch (err) {
      if (active) setError(String(err));
    }
  }

  useEffect(() => {
    let active = true;
    setError(null);
    loadStatus(active);
    return () => {
      active = false;
    };
  }, []);

  async function applyEnv() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await window.launcher.env.apply(selectedEnv);
      setResult(res);
      await loadStatus(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  const currentEnv =
    status && status.ok && status.env ? status.env : result && result.ok ? result.env : selectedEnv;
  const statusText = currentEnv === 'unknown' ? 'env = unknown' : `env = ${currentEnv}`;

  return (
    <section style={styles.panel}>
      <h3 style={{ margin: '0 0 0.5rem' }}>Env - selfpointrest</h3>

      {error && <p style={styles.error}>Error: {error}</p>}
      {status && !status.ok && <p style={styles.error}>{status.message}</p>}

      <p style={styles.status}>
        Status: <strong>{statusText}</strong>
        {status && status.ok && status.hasClientsDir === false ? (
          <span style={styles.warnText}> - clients_dir missing</span>
        ) : null}
      </p>

      <div style={styles.segment} role="group" aria-label="Select selfpointrest env">
        {CHOICES.map((choice) => {
          const active = selectedEnv === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => setSelectedEnv(choice.id)}
              disabled={busy}
              style={{
                ...styles.segmentButton,
                ...(active ? styles.segmentButtonActive : null),
              }}
              aria-pressed={active}
            >
              {choice.label}
            </button>
          );
        })}
      </div>

      <div style={styles.row}>
        <button type="button" onClick={applyEnv} disabled={busy}>
          {busy ? 'Applying...' : 'Apply env'}
        </button>
        <button type="button" onClick={() => loadStatus(true)} disabled={busy}>
          Refresh
        </button>
      </div>

      {result && (
        <div style={result.ok ? styles.notice : styles.error}>
          <strong>{result.ok ? 'OK' : 'Failed'}:</strong> {result.message}
          {result.ok && result.backupCreated ? (
            <>
              <br />
              Backup: <code>{result.backupName}</code>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}

const styles = {
  panel: {
    border: '1px solid #ddd',
    borderRadius: 6,
    padding: '0.75rem 1rem',
  },
  status: {
    margin: '0 0 0.6rem',
  },
  segment: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 0,
    marginBottom: '0.6rem',
    border: '1px solid #c8c8c8',
    borderRadius: 6,
    overflow: 'hidden',
  },
  segmentButton: {
    border: 0,
    borderRight: '1px solid #c8c8c8',
    background: '#fff',
    padding: '0.45rem 0.6rem',
    cursor: 'pointer',
  },
  segmentButtonActive: {
    background: '#eef1fb',
    color: '#243f9e',
    fontWeight: 700,
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    alignItems: 'center',
    marginBottom: '0.6rem',
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
    margin: 0,
    overflowWrap: 'anywhere',
  },
  warnText: {
    color: '#7a4d00',
  },
};
