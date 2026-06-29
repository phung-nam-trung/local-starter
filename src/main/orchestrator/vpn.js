'use strict';

// VPN layer (TD1) — UI-agnostic VPN detection + OpenVPN GUI launch + connection poll.
//
// CONTEXT §9 (Azure VPN via OpenVPN GUI):
//   - openvpn-gui.exe lives at C:\Program Files\OpenVPN\bin\openvpn-gui.exe (default,
//     overridable). The config dir is empty (no .ovpn imported) — the launcher only
//     detects + opens the GUI + waits; it never imports/manages .ovpn files.
//   - Backend (selfpointrest/loyalty/indexer/token-service) needs VPN for internal DB/ES;
//     pure UI builds do not. The UI exposes a Skip for the UI-only flow.
//
// Detection (most reliable first, CONTEXT §9 step 1):
//   1. TCP-connect to an internal host:port the user CONFIGURES (e.g. the DB/ES host from
//      .env). This is the trustworthy signal. NOT hardcoded — the probe host comes from
//      config the user types.
//   2. Fallback (no probe configured): look for a TAP/OpenVPN network adapter that is `Up`
//      via PowerShell Get-NetAdapter.
//
// This module is DELIBERATELY pure Node (no `electron` import) so it can be exercised from
// the CLI with synthetic TCP servers. The native "Hãy đăng nhập VPN" Notification is fired
// by the ipc/main layer (which has electron), NOT here.
//
// Every export returns a SERIALIZABLE plain value / Promise and never throws across IPC.
// Nothing here logs secrets (we never print the probe host's traffic or .env contents).

const net = require('node:net');
const fs = require('node:fs');
const { execFile, spawn } = require('node:child_process');

const isWin = process.platform === 'win32';

// Default OpenVPN GUI path (CONTEXT §9). Overridable via launchOpenVpnGui(exePath).
const DEFAULT_OPENVPN_GUI = 'C:\\Program Files\\OpenVPN\\bin\\openvpn-gui.exe';
const OPENVPN_GUI_IMAGE = 'openvpn-gui.exe';

// probe(host, port, timeoutMs) -> Promise<boolean>
// Attempts a raw TCP connect to host:port. Resolves true when the socket connects, false on
// any error or timeout. The socket is destroyed immediately either way (we only care that a
// connection is POSSIBLE, e.g. the internal DB/ES is reachable => VPN is up). Never throws.
function probe(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const p = Number(port);
    if (!host || !Number.isInteger(p) || p <= 0 || p > 65535) {
      resolve(false);
      return;
    }

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      // Destroy the socket right away — we never send/read any data.
      try {
        socket.destroy();
      } catch (_err) {
        // ignore
      }
      resolve(value);
    };

    const socket = net.connect({ host, port: p });
    socket.setTimeout(Math.max(1, Number(timeoutMs) || 2000));
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

// detectAdapter(execFileImpl) -> Promise<{ connected, detail? }>
// Fallback when no probe host is configured: ask PowerShell for network adapters whose name
// looks like TAP/OpenVPN/Wintun (the virtual adapters OpenVPN brings up) and whose Status is
// 'Up'. Wrapped in try/catch at every layer — any failure resolves connected:false (we never
// want adapter parsing to crash the flow). Returns the matched adapter name in `detail` only
// (an adapter name is not a secret).
function detectAdapter(execFileImpl = execFile) {
  return new Promise((resolve) => {
    if (!isWin) {
      resolve({ connected: false, detail: 'adapter check is Windows-only' });
      return;
    }

    // Emit name|status lines; we parse them ourselves (robust to locale vs. relying on
    // Get-NetAdapter's table formatting). InterfaceDescription is included so TAP/Wintun
    // adapters whose friendly Name was renamed are still matched.
    const script =
      'Get-NetAdapter | ForEach-Object { "$($_.Name)|$($_.InterfaceDescription)|$($_.Status)" }';
    const args = [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script,
    ];

    try {
      execFileImpl(
        'powershell',
        args,
        { windowsHide: true, timeout: 8000 },
        (err, stdout) => {
          if (err) {
            resolve({ connected: false, detail: 'Get-NetAdapter failed' });
            return;
          }
          try {
            const lines = String(stdout || '')
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean);
            const re = /tap|openvpn|wintun|tun\b/i;
            for (const line of lines) {
              const [name = '', desc = '', status = ''] = line.split('|');
              if (re.test(name) || re.test(desc)) {
                if (/^up$/i.test(status.trim())) {
                  resolve({ connected: true, detail: name || desc });
                  return;
                }
              }
            }
            resolve({ connected: false, detail: 'no TAP/OpenVPN adapter Up' });
          } catch (_parseErr) {
            resolve({ connected: false, detail: 'adapter parse error' });
          }
        }
      );
    } catch (_spawnErr) {
      // execFile can throw synchronously in rare cases (e.g. powershell missing).
      resolve({ connected: false, detail: 'adapter check unavailable' });
    }
  });
}

// isVpnConnected(config) -> Promise<{ connected, method, detail? }>
// config:
//   probeHost  : internal host to TCP-probe (user-configured; NOT hardcoded)
//   probePort  : internal port to TCP-probe
//   timeoutMs  : optional probe timeout (default 2000)
//   _execFile  : TEST-ONLY hook to inject a fake execFile for the adapter fallback.
// When a probe host+port is configured we use the TCP probe (method:'probe'). Otherwise we
// fall back to the adapter check (method:'adapter'). If neither is possible the result is
// connected:false, method:'none'. A configured TCP probe is authoritative: if it fails,
// adapter state must not override it.
async function isVpnConnected(config = {}) {
  const host = config.probeHost;
  const port = config.probePort;
  const hasProbe = Boolean(host) && Number.isInteger(Number(port)) && Number(port) > 0;

  if (hasProbe) {
    const connected = await probe(host, port, config.timeoutMs);
    if (connected) {
      return {
        connected: true,
        method: 'probe',
        detail: `reached ${host}:${port}`,
      };
    }

    return {
      connected: false,
      method: 'probe',
      detail: `cannot reach ${host}:${port}`,
    };
  }

  const adapter = await detectAdapter(config._execFile || execFile);
  return {
    connected: adapter.connected,
    method: 'adapter',
    detail: adapter.detail,
  };
}

// isOpenVpnGuiRunning(execFileImpl) -> Promise<boolean>
// READ-ONLY: lists processes via `tasklist` and checks for openvpn-gui.exe. Safe to call in
// tests (no process is started). Resolves false on any error.
function isOpenVpnGuiRunning(execFileImpl = execFile) {
  return new Promise((resolve) => {
    if (!isWin) {
      resolve(false);
      return;
    }
    try {
      // Filter server-side so output is tiny; /NH = no header. If the image isn't running,
      // tasklist prints "INFO: No tasks ..." and exits 0, so we just test for the image name.
      execFileImpl(
        'tasklist',
        ['/FI', `IMAGENAME eq ${OPENVPN_GUI_IMAGE}`, '/NH'],
        { windowsHide: true, timeout: 8000 },
        (err, stdout) => {
          if (err) {
            resolve(false);
            return;
          }
          resolve(new RegExp(OPENVPN_GUI_IMAGE, 'i').test(String(stdout || '')));
        }
      );
    } catch (_err) {
      resolve(false);
    }
  });
}

// launchOpenVpnGui(exePath, spawnImpl) -> Promise<{ ok, launched, message, exePath }>
// Spawns openvpn-gui.exe DETACHED (so it outlives the launcher) and unref's it. Only call
// when the VPN is down AND the GUI is not already running. `exePath` defaults to CONTEXT §9
// but is overridable. `spawnImpl` is a TEST-ONLY hook so tests can verify the path/args
// WITHOUT actually popping the GUI window. Returns a serializable object; never throws.
//
// Note: openvpn-gui.exe with no args just opens/brings up its tray UI (no auto-connect,
// since the config dir is empty) — exactly the "open GUI so the user can log in" behaviour
// CONTEXT §9 step 2 asks for.
function validateOpenVpnGuiPath(target) {
  try {
    const stat = fs.statSync(target);
    if (!stat.isFile()) {
      return { ok: false, message: `OpenVPN GUI path is not a file: ${target}` };
    }
  } catch (err) {
    const reason = err && err.code === 'ENOENT' ? 'not found' : 'not accessible';
    return { ok: false, message: `OpenVPN GUI executable ${reason}: ${target}` };
  }
  return { ok: true };
}

function launchOpenVpnGui(exePath = DEFAULT_OPENVPN_GUI, spawnImpl = spawn) {
  const target = exePath || DEFAULT_OPENVPN_GUI;
  const pathStatus = validateOpenVpnGuiPath(target);
  if (!pathStatus.ok) {
    return Promise.resolve({
      ok: false,
      launched: false,
      exePath: target,
      message: pathStatus.message,
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let child;
    try {
      child = spawnImpl(target, [], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false, // it's a GUI app; let it show its window/tray.
      });
    } catch (err) {
      settle({
        ok: false,
        launched: false,
        exePath: target,
        message: (err && err.message) || String(err),
      });
      return;
    }

    const success = () => {
      try {
        if (child && typeof child.unref === 'function') child.unref();
      } catch (_err) {
        // ignore
      }
      settle({
        ok: true,
        launched: true,
        exePath: target,
        pid: child ? child.pid : null,
        message: `Launched OpenVPN GUI (${target}).`,
      });
    };

    const fail = (err) => {
      settle({
        ok: false,
        launched: false,
        exePath: target,
        message: (err && err.message) || String(err),
      });
    };

    if (child && typeof child.once === 'function') {
      child.once('error', fail);
      child.once('spawn', success);
      return;
    }

    // Compatibility path for simple test doubles that mimic only pid/unref.
    success();
  });
}

// waitForConnection(config, opts) -> { promise, cancel }
// Polls isVpnConnected every intervalMs until connected, or until timeoutMs elapses, or
// until cancel() is called. Calls opts.onTick({ attempt, connected, method, detail }) after
// every check. Resolves { ok, timedOut, cancelled, attempts, method?, detail? } — `ok` is
// true only when a poll observed connected:true.
//
// Cancellation: returns BOTH a promise and a cancel() handle. Callers that prefer a signal
// can pass opts.signal (an AbortSignal); aborting it is equivalent to cancel().
function waitForConnection(config = {}, opts = {}) {
  const intervalMs = Number(opts.intervalMs) > 0 ? Number(opts.intervalMs) : 2500;
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 120000;
  const onTick = typeof opts.onTick === 'function' ? opts.onTick : null;

  let cancelled = false;
  let timer = null;
  let resolveOuter;

  const promise = new Promise((resolve) => {
    resolveOuter = resolve;
  });

  const startedAt = Date.now();
  let attempt = 0;

  function settle(result) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (opts.signal && onAbort) {
      try {
        opts.signal.removeEventListener('abort', onAbort);
      } catch (_err) {
        // ignore
      }
    }
    resolveOuter(result);
  }

  async function tick() {
    if (cancelled) {
      settle({ ok: false, timedOut: false, cancelled: true, attempts: attempt });
      return;
    }

    attempt += 1;
    let status;
    try {
      status = await isVpnConnected(config);
    } catch (_err) {
      status = { connected: false, method: 'none' };
    }

    // A cancel() may have landed while isVpnConnected was awaiting.
    if (cancelled) {
      settle({ ok: false, timedOut: false, cancelled: true, attempts: attempt });
      return;
    }

    if (onTick) {
      try {
        onTick({
          attempt,
          connected: status.connected,
          method: status.method,
          detail: status.detail,
        });
      } catch (_err) {
        // onTick listeners must never break the poll loop.
      }
    }

    if (status.connected) {
      settle({
        ok: true,
        timedOut: false,
        cancelled: false,
        attempts: attempt,
        method: status.method,
        detail: status.detail,
      });
      return;
    }

    if (Date.now() - startedAt >= timeoutMs) {
      settle({
        ok: false,
        timedOut: true,
        cancelled: false,
        attempts: attempt,
        method: status.method,
        detail: status.detail,
      });
      return;
    }

    timer = setTimeout(tick, intervalMs);
  }

  function cancel() {
    if (cancelled) return;
    cancelled = true;
    // If we're between ticks, end now; an in-flight tick checks `cancelled` itself.
    if (timer) {
      clearTimeout(timer);
      timer = null;
      settle({ ok: false, timedOut: false, cancelled: true, attempts: attempt });
    }
  }

  let onAbort = null;
  if (opts.signal) {
    if (opts.signal.aborted) {
      cancelled = true;
    } else {
      onAbort = () => cancel();
      opts.signal.addEventListener('abort', onAbort);
    }
  }

  // Kick off the first poll on the next turn so callers receive { promise, cancel } first.
  setTimeout(tick, 0);

  return { promise, cancel };
}

module.exports = {
  DEFAULT_OPENVPN_GUI,
  OPENVPN_GUI_IMAGE,
  probe,
  detectAdapter,
  isVpnConnected,
  isOpenVpnGuiRunning,
  launchOpenVpnGui,
  waitForConnection,
};
