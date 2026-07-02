'use strict';

// VPN layer (TD1) — UI-agnostic VPN detection + OpenVPN GUI launch + connection poll.
//
// CONTEXT §9 (Azure VPN via OpenVPN GUI):
//   - openvpn-gui.exe lives at C:\Program Files\OpenVPN\bin\openvpn-gui.exe (default,
//     overridable). The config dir is empty (no .ovpn imported) — the launcher only
//     detects + opens the GUI + waits; it never imports/manages .ovpn files.
//   - Backend (selfpointrest/loyalty/indexer/token-service) needs VPN for internal services;
//     pure UI builds do not. The UI exposes a Skip for the UI-only flow.
//
// Detection (Phase M): look for a VPN-style network adapter that is `Up` via the OS tool.
// OpenVPN already owns the profile/auth flow; the launcher only opens the client and waits
// until the adapter comes up. We intentionally do not open test connections to internal hosts.
//
// This module is DELIBERATELY pure Node (no `electron` import) so it can be exercised from
// the CLI with mocked OS commands. The native "Hãy đăng nhập VPN" Notification is fired
// by the ipc/main layer (which has electron), NOT here.
//
// Every export returns a SERIALIZABLE plain value / Promise and never throws across IPC.
// Nothing here logs secrets (we never print .env contents).

const fs = require('node:fs');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');

// Resolve the OS branch. Like platform.js / killTree, every cross-platform helper takes an
// options object so tests can FORCE a platform (options.platform) without touching the real
// process.platform — this is how mac/linux behaviour is verified on a Windows host.
function optionPlatform(options = {}) {
  return options.platform || process.platform;
}

// Default Windows VPN client (CONTEXT §9). macOS default uses the `open -a <App>` launcher;
// Linux has no universal client so we require the user to configure one (TK6). All overridable
// via vpn config (clientPath/clientArgs).
const DEFAULT_OPENVPN_GUI = 'C:\\Program Files\\OpenVPN\\bin\\openvpn-gui.exe';
const OPENVPN_GUI_IMAGE = 'openvpn-gui.exe';
const DEFAULT_MAC_VPN_APP = 'Tunnelblick';

// VPN-interface name patterns. OpenVPN/WireGuard/etc. bring up a virtual adapter whose name
// (Windows) or interface (POSIX) matches one of these — the same idea per OS, different tool.
const VPN_IFACE_RE = /\b(?:tap|tun|utun|ppp|wg|wireguard|openvpn|wintun)\d*\b/i;

// Per-OS adapter detection plan: which command to run + how to parse its output into
// { connected, detail }. Each parser must be total (never throw) and only ever return an
// interface NAME in `detail` (a name is not a secret).
//
//   win32  : PowerShell Get-NetAdapter, emitting Name|Description|Status lines (locale-robust).
//   darwin : `ifconfig` — VPN interfaces appear as utunN/tapN/pppN; we treat a present iface
//            that is not explicitly DOWN as up (macOS tunnels rarely print a clean status line).
//   linux  : `ip -o link show` — each line is "<idx>: <name>: <FLAGS> ..."; a VPN iface counts
//            as connected when its flags contain UP / state is UP.
function adapterPlan(platformName) {
  if (platformName === 'win32') {
    return {
      command: 'powershell',
      args: [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        'Get-NetAdapter | ForEach-Object { "$($_.Name)|$($_.InterfaceDescription)|$($_.Status)" }',
      ],
      parse(stdout) {
        const lines = String(stdout || '')
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        for (const line of lines) {
          const [name = '', desc = '', status = ''] = line.split('|');
          if (VPN_IFACE_RE.test(name) || VPN_IFACE_RE.test(desc)) {
            if (/^up$/i.test(status.trim())) return { connected: true, detail: name || desc };
          }
        }
        return { connected: false, detail: 'no VPN adapter Up' };
      },
    };
  }

  if (platformName === 'darwin') {
    return {
      command: 'ifconfig',
      args: [],
      parse(stdout) {
        // ifconfig blocks start at column 0 with "<iface>: flags=...". A VPN iface is "up"
        // unless its flag list lacks UP (e.g. "<UP,...>" present => active).
        const blocks = String(stdout || '').split(/\n(?=\S)/);
        for (const block of blocks) {
          const header = block.split('\n')[0] || '';
          const name = (header.split(':')[0] || '').trim();
          if (!VPN_IFACE_RE.test(name)) continue;
          if (/\bflags=\S*<[^>]*\bUP\b/i.test(header) || /status:\s*active/i.test(block)) {
            return { connected: true, detail: name };
          }
        }
        return { connected: false, detail: 'no VPN interface up' };
      },
    };
  }

  // linux (and any other POSIX): `ip -o link show` one line per iface.
  return {
    command: 'ip',
    args: ['-o', 'link', 'show'],
    parse(stdout) {
      const lines = String(stdout || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      for (const line of lines) {
        // "<idx>: <name>: <FLAGS,...> ... state UP ..."
        const m = line.match(/^\d+:\s*([^:@]+)[:@]/);
        const name = m ? m[1].trim() : '';
        if (!VPN_IFACE_RE.test(name)) continue;
        if (/\bstate\s+UP\b/i.test(line) || /[<,]UP[,>]/i.test(line)) {
          return { connected: true, detail: name };
        }
      }
      return { connected: false, detail: 'no VPN interface UP' };
    },
  };
}

// detectAdapter(options) -> Promise<{ connected, detail? }>
// Ask the OS for a VPN-style interface that is up. Wrapped in try/catch at every layer — ANY
// failure (spawn error, non-zero exit, parse error) resolves connected:false. Test hooks:
// options.platform forces the OS branch; options.execFileImpl stubs execFile so mac/linux
// output can be fed in on any host.
function detectAdapter(options = {}) {
  const platformName = optionPlatform(options);
  const execFileImpl = options.execFileImpl || execFile;
  const plan = adapterPlan(platformName);

  return new Promise((resolve) => {
    try {
      execFileImpl(plan.command, plan.args, { windowsHide: true, timeout: 8000 }, (err, stdout) => {
        if (err) {
          resolve({ connected: false, detail: `${plan.command} failed` });
          return;
        }
        try {
          resolve(plan.parse(stdout));
        } catch (_parseErr) {
          resolve({ connected: false, detail: 'adapter parse error' });
        }
      });
    } catch (_spawnErr) {
      // execFile can throw synchronously in rare cases (e.g. the tool is missing).
      resolve({ connected: false, detail: 'adapter check unavailable' });
    }
  });
}

// isVpnConnected(config) -> Promise<{ connected, method, detail? }>
// config:
//   platform   : TEST-ONLY hook to force the OS branch for adapter detection.
//   _execFile  : TEST-ONLY hook to inject a fake execFile for adapter detection.
// Always uses the per-OS adapter check (method:'adapter').
async function isVpnConnected(config = {}) {
  const adapter = await detectAdapter({
    platform: config.platform,
    execFileImpl: config._execFile,
  });
  return {
    connected: adapter.connected,
    method: 'adapter',
    detail: adapter.detail,
  };
}

// isOpenVpnGuiRunning(options) -> Promise<boolean>
// READ-ONLY "is the VPN client already running?" check, so we don't pop a second window.
//   win32 : `tasklist` filtered to the client image (default openvpn-gui.exe; or the basename
//           of options.clientPath when the user configured a different exe).
//   posix : SKIP — resolve false. macOS `open -a <App>` is idempotent (re-running just focuses
//           the app) and Linux clients vary too much to detect reliably, so "not running" is
//           the safe answer (worst case we re-issue an idempotent launch). Mockable via
//           options.platform / options.execFileImpl all the same.
// Safe to call in tests (no process is started). Resolves false on any error.
function clientImageName(options = {}) {
  const fromPath = options.clientPath ? path.basename(String(options.clientPath)) : '';
  return fromPath || OPENVPN_GUI_IMAGE;
}

function isOpenVpnGuiRunning(options = {}) {
  const platformName = optionPlatform(options);
  const execFileImpl = options.execFileImpl || execFile;
  const image = clientImageName(options);

  return new Promise((resolve) => {
    if (platformName !== 'win32') {
      resolve(false);
      return;
    }
    try {
      // Filter server-side so output is tiny; /NH = no header. If the image isn't running,
      // tasklist prints "INFO: No tasks ..." and exits 0, so we just test for the image name.
      execFileImpl(
        'tasklist',
        ['/FI', `IMAGENAME eq ${image}`, '/NH'],
        { windowsHide: true, timeout: 8000 },
        (err, stdout) => {
          if (err) {
            resolve(false);
            return;
          }
          resolve(new RegExp(image.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(String(stdout || '')));
        }
      );
    } catch (_err) {
      resolve(false);
    }
  });
}

// launchVpnClient(config, options) -> Promise<{ ok, launched, message, command, args, ... }>
// Spawns the VPN client DETACHED (so it outlives the launcher) and unref's it. Only call when
// the VPN is down AND the client is not already running. The client is per-OS + CONFIGURABLE:
//
//   config.clientPath : explicit launcher command/executable (user-configured). For back-compat
//                       config.exePath is accepted as an alias (old Windows-only field).
//   config.clientArgs : optional args array passed to the client.
//
//   win32  default: openvpn-gui.exe (CONTEXT §9) — opens its tray UI so the user can log in.
//   darwin default: `open -a Tunnelblick` (or the user's clientPath).
//   linux  default: NONE — too varied (nmcli / openvpn3 / openvpn). With no clientPath we DON'T
//                   guess: return { ok:false, reason:'no-client-configured' } so the UI can ask
//                   the user to configure one.
//
// `options.platform` forces the OS branch and `options.spawnImpl` is a TEST hook so tests verify
// the assembled command/args WITHOUT popping a window. Returns a serializable object; never
// throws.

// Validate ONLY absolute executable paths (the Windows default + any absolute user clientPath).
// Bare PATH commands (open / xdg-open / nmcli / openvpn3) are left to spawn's error event, since
// statSync can't see them. Returns { ok } or { ok:false, message }.
function validateClientPath(command) {
  if (!path.isAbsolute(command)) return { ok: true };
  try {
    const stat = fs.statSync(command);
    if (!stat.isFile()) {
      return { ok: false, message: `VPN client path is not a file: ${command}` };
    }
  } catch (err) {
    const reason = err && err.code === 'ENOENT' ? 'not found' : 'not accessible';
    return { ok: false, message: `VPN client executable ${reason}: ${command}` };
  }
  return { ok: true };
}

// Resolve { command, args } (or { reason } when launch is not possible) for the given OS.
function resolveClientPlan(platformName, config = {}) {
  const clientPath = nonEmptyString(config.clientPath) || nonEmptyString(config.exePath) || '';
  const clientArgs = Array.isArray(config.clientArgs) ? config.clientArgs.map(String) : null;

  if (platformName === 'win32') {
    return { command: clientPath || DEFAULT_OPENVPN_GUI, args: clientArgs || [] };
  }

  if (platformName === 'darwin') {
    if (clientPath) return { command: clientPath, args: clientArgs || [] };
    return { command: 'open', args: clientArgs && clientArgs.length ? clientArgs : ['-a', DEFAULT_MAC_VPN_APP] };
  }

  // linux / other POSIX: no universal client — require explicit configuration.
  if (clientPath) return { command: clientPath, args: clientArgs || [] };
  return {
    reason: 'no-client-configured',
    message:
      'Hãy cấu hình lệnh VPN client (vd nmcli/openvpn3) trong VPN settings (clientPath/clientArgs).',
  };
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function launchVpnClient(config = {}, options = {}) {
  const platformName = optionPlatform(options);
  const spawnImpl = options.spawnImpl || spawn;
  const plan = resolveClientPlan(platformName, config);

  if (plan.reason) {
    return Promise.resolve({
      ok: false,
      launched: false,
      reason: plan.reason,
      command: null,
      message: plan.message,
    });
  }

  const pathStatus = validateClientPath(plan.command);
  if (!pathStatus.ok) {
    return Promise.resolve({
      ok: false,
      launched: false,
      reason: 'client-path-invalid',
      command: plan.command,
      exePath: plan.command, // back-compat field name
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
      child = spawnImpl(plan.command, plan.args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: false, // it's a GUI app; let it show its window/tray.
      });
    } catch (err) {
      settle({
        ok: false,
        launched: false,
        reason: 'spawn-error',
        command: plan.command,
        exePath: plan.command,
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
        command: plan.command,
        args: plan.args,
        exePath: plan.command, // back-compat field name
        pid: child ? child.pid : null,
        message: `Launched VPN client (${plan.command}).`,
      });
    };

    const fail = (err) => {
      settle({
        ok: false,
        launched: false,
        reason: 'spawn-error',
        command: plan.command,
        exePath: plan.command,
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

// launchOpenVpnGui(exePath, spawnImpl) -> Promise<...>
// BACK-COMPAT alias (TD1 callers / ipc.js): launch the Windows-default OpenVPN GUI (or the
// given exePath). Delegates to the cross-platform launchVpnClient. Kept so existing callers and
// tests don't break.
function launchOpenVpnGui(exePath = DEFAULT_OPENVPN_GUI, spawnImpl = spawn) {
  return launchVpnClient({ clientPath: exePath }, { spawnImpl });
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
  detectAdapter,
  isVpnConnected,
  isOpenVpnGuiRunning,
  launchVpnClient,
  launchOpenVpnGui,
  waitForConnection,
};
