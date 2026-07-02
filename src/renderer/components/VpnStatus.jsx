import React, { useEffect, useRef, useState } from 'react';

// F5 / TD1 (+ TK6/TM2 cross-platform) — standalone VPN panel: detect the per-OS VPN
// adapter → launch the per-OS VPN client + notify + poll → Skip.
// The VPN client path/args are USER-ENTERED, not hardcoded (CONTEXT §9). The client is per-OS:
// vpn.js defaults to openvpn-gui.exe (win) / `open -a Tunnelblick` (mac); on Linux (or to
// override) the user supplies a client command here.
// Check  : one-shot vpn.check → shows connected/disconnected from the adapter check.
// Connect: launches the GUI (if needed) + fires the native "Hãy đăng nhập VPN" notification
//          + starts adapter polling; tick count / status stream in until connected, timeout,
//          or Skip.
// Skip   : sets a local "skipped" flag (and cancels any poll) so the UI-only flow can proceed
//          without VPN. (Gating "backend needs VPN before start" is a later task; TD1 is the
//          standalone panel + detect/connect/poll/skip.)
export default function VpnStatus() {
  // VPN client command + optional args (cross-platform, TK6). clientArgs is edited as a
  // whitespace-separated string and stored as an array in config.
  const [clientPath, setClientPath] = useState('');
  const [clientArgs, setClientArgs] = useState('');

  const [status, setStatus] = useState(null); // { connected, method, detail }
  const [busy, setBusy] = useState(false); // a check/connect request is in flight
  const [polling, setPolling] = useState(false);
  const [tick, setTick] = useState(null); // latest poll tick
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [skipped, setSkipped] = useState(false);
  // F12 / TI1 — gate save-on-change until the persisted VPN client config is restored.
  const loadedRef = useRef(false);

  // Restore the saved VPN client config on mount. clientArgs is stored as a string[] and shown
  // space-joined. Old configs only had exePath → migrate it into clientPath (vpn.js still reads
  // exePath, but clientPath is the cross-platform field).
  useEffect(() => {
    let active = true;
    window.launcher.config
      .load()
      .then((config) => {
        if (!active) return;
        const vpn = config.vpn || {};
        const path = typeof vpn.clientPath === 'string' && vpn.clientPath
          ? vpn.clientPath
          : typeof vpn.exePath === 'string'
          ? vpn.exePath
          : '';
        setClientPath(path);
        if (Array.isArray(vpn.clientArgs)) setClientArgs(vpn.clientArgs.join(' '));
        loadedRef.current = true;
      })
      .catch(() => {
        if (active) loadedRef.current = true;
      });
    return () => {
      active = false;
    };
  }, []);

  // Persist the client config on change (after restore), debounced so we don't write per
  // keystroke. clientArgs goes back to a string[].
  useEffect(() => {
    if (!loadedRef.current) return;
    const handle = setTimeout(() => {
      const argsArray = clientArgs.trim() === '' ? [] : clientArgs.trim().split(/\s+/);
      window.launcher.config
        .load()
        .then((config) =>
          window.launcher.config.save({
            ...config,
            vpn: {
              clientPath: clientPath.trim(),
              clientArgs: argsArray,
            },
          })
        )
        .catch(() => {});
    }, 400);
    return () => clearTimeout(handle);
  }, [clientPath, clientArgs]);

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
    const args = clientArgs.trim() === '' ? undefined : clientArgs.trim().split(/\s+/);
    return {
      clientPath: clientPath.trim() || undefined,
      clientArgs: args,
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
        parts.push(`VPN client failed: ${res.launch.message || 'unknown error'}.`);
      } else if (res.launch && res.launch.launched) {
        parts.push('Opened VPN client.');
      } else if (res.launch && !res.launch.launched) {
        parts.push('VPN client already running.');
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

  const connState = status?.connected
    ? 'connected'
    : polling
    ? 'connecting'
    : !status
    ? 'unknown'
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

      <label style={{ ...styles.label, marginBottom: '0.6rem' }}>
        VPN client path/command (tùy chọn — mặc định theo OS)
        <input
          type="text"
          value={clientPath}
          onChange={(e) => setClientPath(e.target.value)}
          placeholder="win: openvpn-gui.exe · mac: open · linux: nmcli/openvpn3 (bắt buộc)"
          disabled={busy || polling}
          style={styles.input}
        />
      </label>

      <label style={{ ...styles.label, marginBottom: '0.6rem' }}>
        VPN client args (tùy chọn, cách nhau bằng khoảng trắng)
        <input
          type="text"
          value={clientArgs}
          onChange={(e) => setClientArgs(e.target.value)}
          placeholder="vd: connection up my-vpn"
          disabled={busy || polling}
          style={styles.input}
        />
      </label>

      <p style={styles.meta}>
        Launcher kiểm tra adapter VPN đang Up theo OS (win Get-NetAdapter, mac ifconfig, linux
        ip link). Connect mở VPN client để bạn đăng nhập rồi poll adapter tới khi connected.
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
