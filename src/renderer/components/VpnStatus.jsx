import React, { useEffect, useState } from 'react';

// F5 / TD1 — standalone VPN panel: detect → open OpenVPN GUI + notify + poll → Skip.
// The probe host/port (and optional exe path) are USER-ENTERED, not hardcoded (CONTEXT §9).
// Check  : one-shot vpn.check → shows connected/disconnected + which method (probe/adapter).
// Connect: launches the GUI (if needed) + fires the native "Hãy đăng nhập VPN" notification
//          + starts a poll; tick count / status stream in until connected, timeout, or Skip.
// Skip   : sets a local "skipped" flag (and cancels any poll) so the UI-only flow can proceed
//          without VPN. (Gating "backend needs VPN before start" is a later task; TD1 is the
//          standalone panel + detect/connect/poll/skip.)
export default function VpnStatus() {
  const [probeHost, setProbeHost] = useState('');
  const [probePort, setProbePort] = useState('');
  const [exePath, setExePath] = useState('');

  const [status, setStatus] = useState(null); // { connected, method, detail }
  const [busy, setBusy] = useState(false); // a check/connect request is in flight
  const [polling, setPolling] = useState(false);
  const [tick, setTick] = useState(null); // latest poll tick
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [skipped, setSkipped] = useState(false);

  // Subscribe to poll ticks for the whole panel lifetime. The final tick (final:true) carries
  // the poll outcome ({ ok, timedOut, cancelled }).
  useEffect(() => {
    return window.launcher.vpn.onTick((payload) => {
      if (!payload) return;
      setTick(payload);
      if (payload.final) {
        setPolling(false);
        if (payload.ok) {
          setStatus({ connected: true, method: payload.method, detail: payload.detail });
          setNotice('VPN connected.');
        } else if (payload.timedOut) {
          setNotice('Poll timed out — VPN still not connected.');
        } else if (payload.cancelled) {
          setNotice('Poll cancelled.');
        }
      } else if (payload.connected) {
        setStatus({ connected: true, method: payload.method, detail: payload.detail });
      }
    });
  }, []);

  function configFromInputs() {
    const port = probePort.trim() === '' ? undefined : Number(probePort);
    return {
      probeHost: probeHost.trim() || undefined,
      probePort: Number.isFinite(port) ? port : undefined,
      exePath: exePath.trim() || undefined,
    };
  }

  async function runCheck() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await window.launcher.vpn.check(configFromInputs());
      setStatus(res);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function runConnect() {
    setBusy(true);
    setError(null);
    setNotice(null);
    setTick(null);
    try {
      const res = await window.launcher.vpn.connect(configFromInputs());
      if (!res.ok) {
        setError(res.message || 'Connect failed.');
        return;
      }
      if (res.alreadyConnected) {
        setStatus({ connected: true, method: res.method, detail: res.detail });
        setNotice('Already connected.');
        return;
      }
      setSkipped(false);
      setPolling(Boolean(res.polling));
      const parts = ['H\u00e3y \u0111\u0103ng nh\u1eadp VPN.'];
      if (res.launch && res.launch.ok === false) {
        parts.push(`OpenVPN GUI failed: ${res.launch.message || 'unknown error'}.`);
      } else if (res.launch && res.launch.launched) {
        parts.push('Opened OpenVPN GUI.');
      } else if (res.launch && !res.launch.launched) {
        parts.push('OpenVPN GUI already running.');
      }
      if (res.notified) parts.push('Notification sent.');
      parts.push('Polling for connection...');
      setNotice(parts.join(' '));
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function cancelPoll() {
    try {
      await window.launcher.vpn.cancel();
    } catch (err) {
      setError(String(err));
    }
    setPolling(false);
  }

  async function skip() {
    await cancelPoll();
    setSkipped(true);
    setNotice('VPN skipped — UI-only flow allowed (backend repos still need VPN).');
  }

  const connState = !status
    ? 'unknown'
    : status.connected
    ? 'connected'
    : polling
    ? 'connecting'
    : 'disconnected';
  const stateStyle = styles.badge[connState] || styles.badge.unknown;

  return (
    <section style={styles.panel}>
      <h3 style={{ margin: '0 0 0.5rem' }}>VPN</h3>

      {error && <p style={styles.error}>Loi: {error}</p>}

      <p style={styles.statusLine}>
        Status: <span style={{ ...styles.badgeBase, ...stateStyle }}>{connState}</span>
        {status && status.method ? (
          <span style={styles.meta}> · method: {status.method}</span>
        ) : null}
        {skipped ? <span style={styles.skipTag}> · skipped</span> : null}
      </p>

      {status && status.detail ? <p style={styles.meta}>{status.detail}</p> : null}

      <div style={styles.fieldRow}>
        <label style={styles.label}>
          Probe host
          <input
            type="text"
            value={probeHost}
            onChange={(e) => setProbeHost(e.target.value)}
            placeholder="host nội bộ (vd DB/ES từ .env)"
            disabled={busy || polling}
            style={styles.input}
          />
        </label>
        <label style={{ ...styles.label, flex: '0 0 7rem' }}>
          Port
          <input
            type="number"
            value={probePort}
            onChange={(e) => setProbePort(e.target.value)}
            placeholder="vd 5432"
            disabled={busy || polling}
            style={styles.input}
          />
        </label>
      </div>

      <label style={{ ...styles.label, marginBottom: '0.6rem' }}>
        OpenVPN GUI path (tùy chọn — mặc định CONTEXT §9)
        <input
          type="text"
          value={exePath}
          onChange={(e) => setExePath(e.target.value)}
          placeholder="C:\\Program Files\\OpenVPN\\bin\\openvpn-gui.exe"
          disabled={busy || polling}
          style={styles.input}
        />
      </label>

      <p style={styles.meta}>
        Không nhập probe host → fallback kiểm adapter TAP/OpenVPN qua Get-NetAdapter.
      </p>

      <div style={styles.row}>
        <button type="button" onClick={runCheck} disabled={busy || polling}>
          {busy ? '...' : 'Check'}
        </button>
        <button type="button" onClick={runConnect} disabled={busy || polling}>
          Connect
        </button>
        {polling ? (
          <button type="button" onClick={cancelPoll}>
            Cancel
          </button>
        ) : null}
        <button type="button" onClick={skip} disabled={busy}>
          Skip
        </button>
      </div>

      {polling && tick && !tick.final ? (
        <p style={styles.meta}>
          Đang chờ kết nối... attempt {tick.attempt}
          {tick.detail ? ` (${tick.detail})` : ''}
        </p>
      ) : null}

      {notice && <div style={styles.notice}>{notice}</div>}
    </section>
  );
}

const styles = {
  panel: {
    border: '1px solid #ddd',
    borderRadius: 6,
    padding: '0.75rem 1rem',
  },
  statusLine: {
    margin: '0 0 0.4rem',
  },
  fieldRow: {
    display: 'flex',
    gap: '0.6rem',
    marginBottom: '0.6rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    flex: '1 1 0',
    minWidth: 0,
    fontSize: '0.85rem',
    color: '#555',
  },
  input: {
    padding: '0.35rem 0.45rem',
    border: '1px solid #c8c8c8',
    borderRadius: 4,
    fontSize: '0.9rem',
    minWidth: 0,
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
  badgeBase: {
    display: 'inline-block',
    padding: '0.05rem 0.4rem',
    borderRadius: 10,
    fontSize: '0.8rem',
    fontWeight: 700,
  },
  badge: {
    connected: { background: '#edf7ed', color: '#107c10' },
    disconnected: { background: '#fde7e9', color: '#b00020' },
    connecting: { background: '#fff4ce', color: '#7a4d00' },
    unknown: { background: '#eee', color: '#555' },
  },
  skipTag: {
    color: '#7a4d00',
    fontSize: '0.85rem',
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
    color: '#243f9e',
    background: '#eef1fb',
    padding: '0.45rem 0.6rem',
    borderRadius: 4,
    margin: 0,
    overflowWrap: 'anywhere',
  },
};
