'use strict';

const { spawn, execFile } = require('node:child_process');

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

function optionPlatform(options = {}) {
  return options.platform || process.platform;
}

function pmCommand(packageManager, options = {}) {
  const suffix = optionPlatform(options) === 'win32' ? '.cmd' : '';
  if (packageManager === 'npm') return `npm${suffix}`;
  if (packageManager === 'pnpm') return `pnpm${suffix}`;
  throw new Error(`Unsupported package manager: ${packageManager || '(missing)'}`);
}

function openCommandFor(platformName, targetPath) {
  if (platformName === 'win32') {
    return {
      command: 'cmd',
      args: ['/c', 'start', '""', targetPath],
      // Back-compat with indexer.openTestFiles metadata.
      tool: 'cmd /c start',
      argv: ['/c', 'start', '""', targetPath],
      spawnOptions: {
        windowsHide: true,
        detached: true,
        stdio: 'ignore',
      },
    };
  }

  const command = platformName === 'darwin' ? 'open' : 'xdg-open';
  return {
    command,
    args: [targetPath],
    tool: command,
    argv: [targetPath],
    spawnOptions: {
      detached: true,
      stdio: 'ignore',
    },
  };
}

function openPath(targetPath, options = {}) {
  const platformName = optionPlatform(options);
  const spawnImpl = options.spawnImpl || spawn;
  const plan = openCommandFor(platformName, targetPath);
  const child = spawnImpl(plan.command, plan.args, plan.spawnOptions);
  if (child && typeof child.unref === 'function') {
    child.unref();
  }
  return {
    platform: platformName,
    command: plan.command,
    args: plan.args,
    tool: plan.tool,
    argv: plan.argv,
  };
}

// killTree(pid, options) — kill an ENTIRE process tree cross-platform. Resolves a
// serializable { ok, message }; never throws (callers go through IPC).
//
//   win32  : `taskkill /PID <pid> /T /F` — /T kills children, /F forces. taskkill exits
//            128 if the process is already gone; we treat that as success (goal met).
//   posix  : negative-PID signals the whole PROCESS GROUP — but only when the leader was
//            spawned `detached:true` (so its pid == pgid). We send SIGTERM to -pid, wait
//            briefly, then SIGKILL -pid if anything is still alive. ESRCH = already dead =
//            success.
//
// Test hooks (mirror openPath): options.platform forces the OS branch; options.execFileImpl
// stubs taskkill (win); options.killImpl stubs process.kill (posix). options.posixTermWaitMs
// shortens the SIGTERM→SIGKILL grace in tests.
function killTree(pid, options = {}) {
  const platformName = optionPlatform(options);

  return new Promise((resolve) => {
    if (pid == null) {
      resolve({ ok: true, message: 'No PID to kill.' });
      return;
    }

    if (platformName === 'win32') {
      const execFileImpl = options.execFileImpl || execFile;
      // PID is a number → no quoting needed. windowsHide avoids a console flash.
      execFileImpl('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, (err, _out, stderr) => {
        if (err) {
          const detail = (stderr || err.message || '').toString().trim();
          // 128 = process not found (already exited) — not an error for our purposes.
          if (err.code === 128 || /not found|không tìm thấy/i.test(detail)) {
            resolve({ ok: true, message: 'Process already exited.' });
            return;
          }
          resolve({ ok: false, message: `taskkill failed: ${detail}` });
          return;
        }
        resolve({ ok: true, message: `taskkill /T /F /PID ${pid} done.` });
      });
      return;
    }

    // POSIX (darwin/linux): group-kill via negative pid (requires detached spawn).
    const killImpl = options.killImpl || process.kill.bind(process);
    const graceMs = Number.isFinite(options.posixTermWaitMs) ? options.posixTermWaitMs : 3000;

    const tryKill = (signal) => {
      try {
        killImpl(-pid, signal);
        return { delivered: true };
      } catch (err) {
        if (err && err.code === 'ESRCH') return { delivered: false, gone: true };
        return { delivered: false, error: (err && err.message) || String(err) };
      }
    };

    const term = tryKill('SIGTERM');
    if (term.gone) {
      resolve({ ok: true, message: 'Process already exited.' });
      return;
    }
    if (term.error) {
      resolve({ ok: false, message: term.error });
      return;
    }

    // Give the group a moment to exit on SIGTERM, then force-kill any survivors.
    setTimeout(() => {
      const probe = tryKill('SIGKILL');
      if (probe.gone || probe.delivered) {
        resolve({ ok: true, message: `Killed process group ${pid} (SIGTERM→SIGKILL).` });
        return;
      }
      resolve({ ok: false, message: probe.error || `Failed to kill process group ${pid}.` });
    }, graceMs);
  });
}

module.exports = {
  isWin,
  isMac,
  isLinux,
  pmCommand,
  openPath,
  killTree,
};
