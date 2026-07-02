'use strict';

// Process orchestrator (TF1) — UI-agnostic lifecycle for every repo in the registry.
// Foundation for TF2/TF3 (more repos + PORT override) and TH (status table + stop all).
//
// A "run" for a repo is a SEQUENCE of build steps (one-shot, must exit 0 to continue)
// followed by ONE long-running start step (we keep its PID). For selfpointrest the
// sequence is, in order:
//   1. optional UI builds (build-backend / build-kikar / build-prutah) — opts.buildUIs
//   2. the main build (npm run buildAll)
//   3. start (npm start) — long-running on port 3000
//
// Commands and cwd values come from the registry (repos.js). We never hardcode repo paths
// here, so loyalty/token-service/stor-web/etc. drive through the SAME engine (their build
// step is just skipped when null).
//
// Process-tree handling (CONTEXT §10.2/§10.3) — cross-platform via platform.killTree:
//   - We always spawn with shell:true so npm.cmd / pnpm.cmd (win) and npm/pnpm (posix)
//     resolve; windowsHide:true.
//   - Windows: stop() kills the WHOLE tree via `taskkill /T /F /PID <pid>` — npm/gulp/next
//     spawn many children, so killing only the shell PID would orphan them.
//   - POSIX: the long-running step is spawned `detached:true` so the shell becomes a
//     process-group LEADER; stop() then group-kills via `process.kill(-pid, …)` (SIGTERM
//     then SIGKILL). Without detached, a plain process.kill(pid) would orphan the children.
//     We do NOT detach on Windows — that would pop a new console window.
//
// Every exported function returns a SERIALIZABLE plain object and never throws across IPC.

const { spawn } = require('node:child_process');
const { getRepo, repos } = require('./repos');
const deps = require('./deps');
const { isPortBusy, repoForPort } = require('./ports');
const platform = require('./platform');

const isWin = platform.isWin;

// State model (plan §2 / CONTEXT §11): stopped | building | running | crashed.
// We also surface 'starting' transiently while a run is being set up.
const STATES = Object.freeze({
  STOPPED: 'stopped',
  STARTING: 'starting',
  BUILDING: 'building',
  RUNNING: 'running',
  CRASHED: 'crashed',
});

const LOG_TAIL_LIMIT = 24000;

// One entry per repoId. Holds the live long-running child (if any), the one-shot build
// child currently running (so stop() can also kill a build), the current step label,
// PID, exit info, and a rolling log tail.
const runners = new Map();

function getEntry(repoId) {
  let entry = runners.get(repoId);
  if (!entry) {
    entry = {
      repoId,
      state: STATES.STOPPED,
      step: null, // human label of the current/last step
      pid: null, // PID of the long-running start process
      port: null, // effective port (may be overridden via opts.port)
      child: null, // ChildProcess of the long-running start step
      buildChild: null, // ChildProcess of the in-flight one-shot build step
      stopping: false, // true while a user-initiated stop is in progress
      startedAt: null,
      exitCode: null,
      exitSignal: null,
      logTail: '',
    };
    runners.set(repoId, entry);
  }
  return entry;
}

// Public, serializable snapshot of a repo's run state (safe to send across IPC).
function snapshot(entry, repo) {
  return {
    repoId: entry.repoId,
    state: entry.state,
    step: entry.step,
    pid: entry.pid,
    port: entry.port != null ? entry.port : repo ? repo.port : null,
    running: entry.state === STATES.RUNNING || entry.state === STATES.BUILDING,
    startedAt: entry.startedAt,
    exitCode: entry.exitCode,
    exitSignal: entry.exitSignal,
  };
}

function appendTail(current, chunk) {
  const next = `${current}${chunk}`;
  return next.length > LOG_TAIL_LIMIT ? next.slice(next.length - LOG_TAIL_LIMIT) : next;
}

function emit(onOutput, payload) {
  if (typeof onOutput !== 'function') return;
  try {
    onOutput({ timestamp: new Date().toISOString(), ...payload });
  } catch (_err) {
    // Log listeners must never break the run.
  }
}

// Build the ordered list of steps for a repo + options. Each step is one-shot unless
// `longRunning` is true (the final start step). Commands are strings from the registry;
// they run via the shell (shell:true), so e.g. "npm run buildAll" works as-is. A step can
// carry its own cwd when it intentionally differs from repo.runCwd.
//
// opts:
//   buildUIs   : { backend?, kikar?, prutah? } — selfpointrest only; build before buildAll.
//   skipBuild  : skip the repo's own build step (e.g. start without rebuilding).
//   commandOverride : { build?: string[], start?: string } — TEST-ONLY hook so synthetic
//                     processes can exercise the engine without touching the registry.
function buildSteps(repo, opts = {}) {
  // Test hook: fully synthetic command list, bypassing the registry commands.
  if (opts.commandOverride) {
    const steps = [];
    for (const cmd of opts.commandOverride.build || []) {
      steps.push({ kind: 'build', label: cmd, command: cmd, longRunning: false });
    }
    if (opts.commandOverride.start) {
      steps.push({
        kind: 'start',
        label: opts.commandOverride.start,
        command: opts.commandOverride.start,
        longRunning: true,
      });
    }
    return steps;
  }

  const steps = [];

  // selfpointrest UI builds use the sp-local-workspace root builder. buildAll/start below
  // still use selfpointrest's runCwd. Order: backend, kikar, prutah.
  if (repo.id === 'selfpointrest' && opts.buildUIs) {
    const ui = opts.buildUIs;
    const backendBuildCwd = (getRepo('backend') || {}).buildCwd;
    const frontendBuildCwd = (getRepo('frontend') || {}).buildCwd;
    if (ui.backend) {
      steps.push({
        kind: 'build',
        label: 'build-backend',
        command: 'npm run build-backend',
        cwd: backendBuildCwd,
      });
    }
    if (ui.kikar) {
      steps.push({
        kind: 'build',
        label: 'build-kikar',
        command: 'npm run build-kikar',
        cwd: frontendBuildCwd,
      });
    }
    if (ui.prutah) {
      steps.push({
        kind: 'build',
        label: 'build-prutah',
        command: 'npm run build-prutah',
        cwd: frontendBuildCwd,
      });
    }
  }

  // The repo's own build step (selfpointrest: npm run buildAll; token-service: npm run build).
  if (repo.build && !opts.skipBuild) {
    steps.push({ kind: 'build', label: repo.build, command: repo.build });
  }

  // The long-running start step.
  if (repo.start) {
    steps.push({ kind: 'start', label: repo.start, command: repo.start, longRunning: true });
  }

  return steps;
}

function hasSelectedBuildUi(buildUIs) {
  return Boolean(buildUIs && (buildUIs.backend || buildUIs.kikar || buildUIs.prutah));
}

function buildUiDependencyTargets(buildUIs) {
  if (!hasSelectedBuildUi(buildUIs)) return [];

  const targets = [deps.INSTALL_TARGETS.SP_WORKSPACE_ROOT];
  if (buildUIs.backend) targets.push('backend');
  if (buildUIs.kikar || buildUIs.prutah) targets.push('frontend');
  return targets;
}

function dependencyLabel(targetId) {
  if (targetId === deps.INSTALL_TARGETS.SP_WORKSPACE_ROOT) return 'sp-local-workspace root';
  const target = getRepo(targetId);
  return target ? target.name : targetId;
}

function dependencyInstallText(targetId, result) {
  const status = result && result.status;
  const target = deps.getDependencyTarget(targetId);
  const packageManager = (status && status.packageManager) || (target && target.packageManager) || 'npm';
  const installCwd = (status && status.installCwd) || (result && result.installCwd) || (target && target.installCwd);
  return `Run "${packageManager} install"${installCwd ? ` in ${installCwd}` : ''}.`;
}

async function checkBuildUiPrerequisites(buildUIs) {
  const targetIds = buildUiDependencyTargets(buildUIs);
  if (targetIds.length === 0) {
    return { ok: true, checks: [] };
  }

  const checks = [];
  for (const targetId of targetIds) {
    const result = await deps.getDependencyStatus(targetId);
    checks.push({
      targetId,
      label: dependencyLabel(targetId),
      ...result,
    });
  }

  const blockers = checks.filter((check) => !check.ok || (check.status && check.status.needed));
  if (blockers.length === 0) {
    return { ok: true, checks };
  }

  const lines = blockers.map((check) => {
    const detail = check.ok && check.status ? check.status.message : check.message;
    return `- ${check.label}: ${detail || 'dependency status unavailable'} ${dependencyInstallText(check.targetId, check)}`;
  });

  return {
    ok: false,
    reason: 'missing-build-ui-deps',
    checks,
    blockers,
    message: [
      'Build UI prerequisites are missing or stale; no build step was started.',
      ...lines,
    ].join('\n'),
  };
}

// Compute the effective port + env for spawning. PORT override (opts.port) is prepared
// here for TF2 (loyalty/token-service both default to 4000). We only set PORT in the
// child env when an override is provided, so default behaviour is unchanged.
function resolveEnv(repo, opts) {
  const env = { ...process.env, FORCE_COLOR: '0' };
  let port = repo ? repo.port : null;
  if (opts.port != null && Number.isFinite(Number(opts.port))) {
    port = Number(opts.port);
    env.PORT = String(port);
  }
  return { env, port };
}

// Spawn one command (string) in cwd via the shell. Returns the ChildProcess. Streams
// stdout/stderr to onOutput tagged with repoId + step label.
function spawnStep(entry, repo, step, cwd, env, onOutput) {
  emit(onOutput, {
    repoId: repo.id,
    stream: 'status',
    step: step.label,
    text: `[${step.label}] $ ${step.command}  (cwd=${cwd})\n`,
  });

  // shell:true => pass the full command string as a single argument. This keeps npm.cmd /
  // pnpm.cmd and chained args working on Windows; cwd (set separately) handles spaces in
  // the path so we never have to quote it inside the command string.
  //
  // detached only on POSIX: it makes the shell a process-group leader (pid == pgid) so
  // stop() can group-kill the whole tree via platform.killTree(-pid). On Windows we must
  // NOT detach (it would open a new console window) — taskkill /T already walks the tree.
  const spawnOptions = {
    cwd,
    env,
    shell: true,
    windowsHide: true,
  };
  if (!isWin) {
    spawnOptions.detached = true;
  }
  const child = spawn(step.command, spawnOptions);

  const tag = (stream) => (chunk) => {
    const text = chunk.toString();
    entry.logTail = appendTail(entry.logTail, text);
    emit(onOutput, { repoId: repo.id, stream, step: step.label, text });
  };
  if (child.stdout) child.stdout.on('data', tag('stdout'));
  if (child.stderr) child.stderr.on('data', tag('stderr'));

  return child;
}

// Run a single one-shot build step to completion. Resolves { ok, code, signal, error? }.
function runBuildStep(entry, repo, step, cwd, env, onOutput) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnStep(entry, repo, step, cwd, env, onOutput);
    } catch (err) {
      resolve({ ok: false, error: (err && err.message) || String(err) });
      return;
    }
    entry.buildChild = child;

    child.on('error', (err) => {
      entry.buildChild = null;
      const message =
        err && err.code === 'ENOENT'
          ? `Command not found for step "${step.label}". Check PATH (npm/pnpm) and reopen the app.`
          : (err && err.message) || String(err);
      emit(onOutput, { repoId: repo.id, stream: 'stderr', step: step.label, text: `${message}\n` });
      resolve({ ok: false, error: message });
    });

    child.on('close', (code, signal) => {
      entry.buildChild = null;
      if (code === 0) {
        emit(onOutput, {
          repoId: repo.id,
          stream: 'status',
          step: step.label,
          text: `[${step.label}] completed.\n`,
        });
        resolve({ ok: true, code, signal });
        return;
      }
      // If the user stopped us mid-build, don't treat it as a build failure.
      if (entry.stopping) {
        resolve({ ok: false, stopped: true, code, signal });
        return;
      }
      const message =
        signal == null
          ? `[${step.label}] failed with exit code ${code}.`
          : `[${step.label}] terminated by signal ${signal}.`;
      emit(onOutput, { repoId: repo.id, stream: 'stderr', step: step.label, text: `${message}\n` });
      resolve({ ok: false, code, signal, error: message });
    });
  });
}

// Spawn the long-running start step. Wires exit handling so that an UNEXPECTED exit moves
// the repo to 'crashed' (CONTEXT §10.3), while a user stop leaves it 'stopped'.
function spawnLongRunning(entry, repo, step, cwd, env, port, onOutput) {
  let child;
  try {
    child = spawnStep(entry, repo, step, cwd, env, onOutput);
  } catch (err) {
    const message = (err && err.message) || String(err);
    entry.state = STATES.CRASHED;
    entry.step = step.label;
    emit(onOutput, { repoId: repo.id, stream: 'stderr', step: step.label, text: `${message}\n` });
    return { ok: false, error: message };
  }

  entry.child = child;
  entry.pid = child.pid;
  entry.port = port;
  entry.state = STATES.RUNNING;
  entry.step = step.label;
  entry.startedAt = new Date().toISOString();
  entry.exitCode = null;
  entry.exitSignal = null;

  child.on('error', (err) => {
    // An error after a successful spawn (rare) — surface and mark crashed unless stopping.
    const message = (err && err.message) || String(err);
    emit(onOutput, { repoId: repo.id, stream: 'stderr', step: step.label, text: `${message}\n` });
    if (!entry.stopping) {
      entry.state = STATES.CRASHED;
    }
  });

  child.on('close', (code, signal) => {
    entry.child = null;
    entry.pid = null;
    entry.exitCode = code;
    entry.exitSignal = signal;
    if (entry.stopping) {
      // Expected exit from stop(): the repo is now cleanly stopped.
      entry.state = STATES.STOPPED;
      emit(onOutput, {
        repoId: repo.id,
        stream: 'status',
        step: step.label,
        text: `[${step.label}] stopped.\n`,
      });
    } else {
      // Process died on its own → crashed (CONTEXT §10.3).
      entry.state = STATES.CRASHED;
      const text =
        signal == null
          ? `[${step.label}] exited unexpectedly (code ${code}) → crashed.\n`
          : `[${step.label}] killed unexpectedly (signal ${signal}) → crashed.\n`;
      emit(onOutput, { repoId: repo.id, stream: 'stderr', step: step.label, text });
    }
  });

  return { ok: true, pid: child.pid, port };
}

// start(repoId, opts) — run the full sequence for a repo.
// Resolves a serializable result with the final snapshot. Build steps run sequentially;
// if any build fails we stop and report (state → crashed) without spawning start.
async function start(repoId, opts = {}) {
  // commandOverride is a TEST-ONLY hook (synthetic processes). For an unknown synthetic
  // repoId the cwd is irrelevant (override commands are self-contained), so default it to
  // the launcher's own cwd. Real repos always come from the registry with a runCwd.
  const repo = opts.commandOverride
    ? getRepo(repoId) || { id: repoId, port: null, runCwd: opts.cwd || process.cwd() }
    : getRepo(repoId);

  if (!repo) {
    return { ok: false, reason: 'unknown-repo', message: `Unknown repoId: ${repoId}` };
  }

  const entry = getEntry(repoId);

  // Build-only repos (backend/frontend) have no own server — selfpointrest builds and
  // serves their static output (CONTEXT §6). Refuse start at the ENGINE level (not just the
  // UI button) so NO caller (TF2/TH or a future module) can trigger a heavy real build by
  // "starting" them. The commandOverride test hook bypasses this (synthetic repos aren't
  // in the registry, so repo.buildOnly is undefined).
  if (repo.buildOnly && !opts.commandOverride) {
    return {
      ok: false,
      reason: 'build-only',
      message: `Repo ${repoId} is build-only — build it via selfpointrest (build-backend/build-kikar/build-prutah); it has no own server to start.`,
      status: snapshot(entry, repo),
    };
  }

  if (entry.state === STATES.RUNNING || entry.state === STATES.BUILDING || entry.state === STATES.STARTING) {
    return {
      ok: false,
      reason: 'busy',
      message: `${repoId} is already ${entry.state}. Stop it first.`,
      status: snapshot(entry, repo),
    };
  }

  const cwd = opts.cwd || repo.runCwd;
  if (!cwd) {
    return { ok: false, reason: 'error', message: `Repo ${repoId} has no runCwd.` };
  }

  const steps = buildSteps(repo, opts);
  if (steps.length === 0) {
    return {
      ok: false,
      reason: 'no-steps',
      message: `Repo ${repoId} has no start command (build-only). Build it via its serving repo.`,
      status: snapshot(entry, repo),
    };
  }

  if (repo.id === 'selfpointrest' && hasSelectedBuildUi(opts.buildUIs) && !opts.commandOverride) {
    const prereqs = await checkBuildUiPrerequisites(opts.buildUIs);
    if (!prereqs.ok) {
      entry.state = STATES.STOPPED;
      entry.step = null;
      return {
        ok: false,
        reason: prereqs.reason,
        message: prereqs.message,
        prerequisites: prereqs.checks,
        status: snapshot(entry, repo),
      };
    }
  }

  const onOutput = opts.onOutput;
  const { env, port } = resolveEnv(repo, opts);

  // Reset transient state for a fresh run.
  entry.stopping = false;
  entry.exitCode = null;
  entry.exitSignal = null;
  entry.state = STATES.STARTING;

  const buildSteps2 = steps.filter((s) => !s.longRunning);
  const startStep = steps.find((s) => s.longRunning) || null;

  // Run build steps one-shot, in order.
  for (const step of buildSteps2) {
    entry.state = STATES.BUILDING;
    entry.step = step.label;
    const stepCwd = step.cwd || cwd;
    const res = await runBuildStep(entry, repo, step, stepCwd, env, onOutput);
    if (entry.stopping) {
      entry.state = STATES.STOPPED;
      return {
        ok: false,
        reason: 'stopped',
        message: `Run stopped during "${step.label}".`,
        status: snapshot(entry, repo),
      };
    }
    if (!res.ok) {
      entry.state = STATES.CRASHED;
      return {
        ok: false,
        reason: 'build-failed',
        failedStep: step.label,
        code: res.code,
        message: res.error || `Build step "${step.label}" failed.`,
        status: snapshot(entry, repo),
      };
    }
  }

  if (!startStep) {
    // Build-only sequence (e.g. opts.skipStart in future) — nothing long-running to keep.
    entry.state = STATES.STOPPED;
    entry.step = null;
    return { ok: true, message: 'Build steps completed (no start step).', status: snapshot(entry, repo) };
  }

  // Pre-start port guard (TF2). Right before spawning the long-running server, refuse if its
  // effective port is already taken — otherwise the dev server would just crash with
  // EADDRINUSE after we report "started". Skipped when: the repo has no port (build-only),
  // or opts.force is set (user chose to start anyway). restart() goes through stop() first,
  // which frees the port, so a normal restart is never blocked by its own previous run.
  if (port != null && !opts.force) {
    const busy = await isPortBusy(port);
    if (busy) {
      // Don't leave the repo stuck in STARTING — nothing was spawned.
      entry.state = STATES.STOPPED;
      entry.step = null;
      const holder = repoForPort(port);
      const holderText =
        holder && holder !== repoId ? ` (co the dang bi giu boi "${holder}")` : '';
      return {
        ok: false,
        reason: 'port-busy',
        port,
        heldBy: holder,
        message: `Port ${port} dang ban${holderText}. Stop process dang giu port, hoac Start anyway (force) de bo qua.`,
        status: snapshot(entry, repo),
      };
    }
  }

  const startCwd = startStep.cwd || cwd;
  const res = spawnLongRunning(entry, repo, startStep, startCwd, env, port, onOutput);
  if (!res.ok) {
    return {
      ok: false,
      reason: 'spawn-error',
      message: res.error || 'Failed to start process.',
      status: snapshot(entry, repo),
    };
  }

  return {
    ok: true,
    message: `Started ${repoId} (pid ${res.pid}${port != null ? `, port ${port}` : ''}).`,
    status: snapshot(entry, repo),
  };
}

// Kill an entire process tree. Delegates to platform.killTree, which uses taskkill /T /F on
// Windows and a detached process-group kill (SIGTERM→SIGKILL) on POSIX. Resolves { ok,
// message }. The POSIX group-kill only reaches children because the long-running step is
// spawned detached (see spawnStep).
function killTree(pid) {
  return platform.killTree(pid);
}

// Wait until the long-running child's 'close' has fired (state left RUNNING/BUILDING),
// or a timeout elapses. Returns true if it exited, false on timeout.
function waitForExit(entry, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (!entry.child && entry.state !== STATES.BUILDING) {
        resolve(true);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}

// stop(repoId) — kill the whole tree of the active long-running process (and any in-flight
// build). Marks `stopping` first so the close handler reports 'stopped' (not 'crashed').
async function stop(repoId) {
  const repo = getRepo(repoId);
  const entry = runners.get(repoId);
  if (!entry || (entry.state === STATES.STOPPED && !entry.child && !entry.buildChild)) {
    return {
      ok: true,
      message: `${repoId} is not running.`,
      status: entry ? snapshot(entry, repo) : { repoId, state: STATES.STOPPED, running: false },
    };
  }

  entry.stopping = true;

  // Kill the long-running start process tree (if any) and the in-flight build (if any).
  const pids = [];
  if (entry.pid != null) pids.push(entry.pid);
  if (entry.buildChild && entry.buildChild.pid != null) pids.push(entry.buildChild.pid);

  const kills = [];
  for (const pid of pids) kills.push(await killTree(pid));

  // Let the close handlers settle the state to 'stopped'.
  await waitForExit(entry);

  // If nothing was actually running (e.g. only a build child), make state explicit.
  if (entry.state !== STATES.STOPPED) {
    entry.state = STATES.STOPPED;
  }
  entry.stopping = false;
  entry.child = null;
  entry.buildChild = null;
  entry.pid = null;

  const failed = kills.find((k) => !k.ok);
  return {
    ok: !failed,
    message: failed ? failed.message : `Stopped ${repoId} (tree-kill).`,
    killed: pids,
    status: snapshot(entry, repo),
  };
}

// stopAll() — stop EVERY active repo (TH2 / F9). "Active" = the runners map holds an entry
// that is running/building/starting OR still has a live long-running/build child. We reuse
// stop(repoId) for each one, so each gets the same tree-kill (`taskkill /T /F`) that frees
// its port and leaves no orphan node/gulp/next children. Stops run sequentially (each stop
// is independent; sequential keeps taskkill output un-interleaved and is plenty fast for ~9
// repos). A repo that was never started has no entry, so it is skipped. Returns a
// serializable { ok, stopped:[repoId...], results:[...] }; nothing running => { ok:true,
// stopped:[] }. Never throws across IPC (stop() itself never throws).
async function stopAll() {
  const active = [];
  for (const entry of runners.values()) {
    if (
      entry.state === STATES.RUNNING ||
      entry.state === STATES.BUILDING ||
      entry.state === STATES.STARTING ||
      entry.child ||
      entry.buildChild
    ) {
      active.push(entry.repoId);
    }
  }

  const results = [];
  for (const repoId of active) {
    results.push(await stop(repoId));
  }

  return {
    ok: results.every((r) => r.ok),
    stopped: active,
    results,
  };
}

// restart(repoId, opts) — stop then start with the same options.
async function restart(repoId, opts = {}) {
  const stopResult = await stop(repoId);
  if (!stopResult.ok) {
    return { ok: false, reason: 'stop-failed', message: stopResult.message, status: stopResult.status };
  }
  const startResult = await start(repoId, opts);
  return { ...startResult, restarted: true };
}

// getStatus(repoId) — serializable snapshot for the UI / status table (TH1).
function getStatus(repoId) {
  const repo = getRepo(repoId);
  const entry = runners.get(repoId);
  if (!entry) {
    return {
      repoId,
      state: STATES.STOPPED,
      step: null,
      pid: null,
      port: repo ? repo.port : null,
      running: false,
      startedAt: null,
      exitCode: null,
      exitSignal: null,
    };
  }
  return snapshot(entry, repo);
}

// getAllStatuses() — serializable snapshot for EVERY repo in the registry (TH1 status table).
// Reuses getStatus so each row follows the same contract; a repo that was never started has
// no runners entry and therefore resolves to a 'stopped' snapshot with its default port.
// In-memory only (no git/process spawn) — cheap enough for the UI to poll on an interval.
function getAllStatuses() {
  return repos.map((repo) => getStatus(repo.id));
}

// Build the exact command sequence a repo WOULD run, without spawning anything. Used by
// the UI to show the plan and by static verification (TF1 safety: assemble selfpointrest's
// command chain without executing it).
function describeRun(repoId, opts = {}) {
  const repo = getRepo(repoId);
  if (!repo) return { ok: false, reason: 'unknown-repo', message: `Unknown repoId: ${repoId}` };
  const cwd = opts.cwd || repo.runCwd;
  const { port } = resolveEnv(repo, opts);
  const steps = buildSteps(repo, opts).map((s) => ({
    kind: s.kind,
    label: s.label,
    command: s.command,
    cwd: s.cwd || cwd,
    longRunning: Boolean(s.longRunning),
  }));
  return {
    ok: true,
    repoId,
    cwd,
    port,
    portOverridden: opts.port != null,
    buildOnly: Boolean(repo.buildOnly),
    servedBy: repo.servedBy || null,
    dependencyPrerequisites: repo.id === 'selfpointrest'
      ? buildUiDependencyTargets(opts.buildUIs).map((targetId) => {
          const target = deps.getDependencyTarget(targetId);
          return {
            targetId,
            label: dependencyLabel(targetId),
            packageManager: target ? target.packageManager : null,
            installCwd: target ? target.installCwd : null,
          };
        })
      : [],
    steps,
  };
}

module.exports = {
  STATES,
  start,
  stop,
  stopAll,
  restart,
  getStatus,
  getAllStatuses,
  checkBuildUiPrerequisites,
  describeRun,
};
