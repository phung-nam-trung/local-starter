'use strict';

const { ipcMain, Notification } = require('electron');
const repos = require('./orchestrator/repos');
const git = require('./orchestrator/git');
const deps = require('./orchestrator/deps');
const env = require('./orchestrator/env');
const runner = require('./orchestrator/runner');
const ports = require('./orchestrator/ports');
const vpn = require('./orchestrator/vpn');
const indexer = require('./orchestrator/indexer');

// VPN (TD1) — at most ONE poll runs at a time. We keep its cancel() handle so vpn:cancel
// (and a fresh vpn:connect) can stop the previous poll. The poll handle lives in main (not
// in vpn.js) because the native Notification needs electron.
let vpnPoll = null;

function cancelVpnPoll() {
  if (vpnPoll && typeof vpnPoll.cancel === 'function') {
    vpnPoll.cancel();
  }
  vpnPoll = null;
}

// Registers all IPC handlers. Called once from main.js after app is ready.
// Keep channels narrow and return metadata only (the registry holds no secrets).
function setupIpc() {
  // repos:list — renderer fetches the repo registry to render the repo list (F1 / TA2).
  // Spread into a fresh array of plain objects so the IPC structured-clone only sees
  // serializable data (the registry module also carries helper fns like getRepo).
  ipcMain.handle('repos:list', () => repos.map((r) => ({ ...r })));

  // Git read-only handlers (F2/F3 groundwork — TB1). git.js already returns plain
  // serializable values (strings / arrays of plain objects), so they cross IPC as-is.
  ipcMain.handle('git:listBranches', (_event, repoId) => git.listBranches(repoId));
  ipcMain.handle('git:currentBranch', (_event, repoId) => git.currentBranch(repoId));
  ipcMain.handle('git:isClean', (_event, repoId) => git.isClean(repoId));

  // Git mutating handlers (F3 — TB2). fetch/checkout/pull return SERIALIZABLE result
  // objects ({ ok, reason?, branch?, message }) — they never throw across IPC, and
  // checkout/pull refuse a dirty tree (reason:'dirty') so local changes are never lost.
  ipcMain.handle('git:fetch', (_event, repoId) => git.fetch(repoId));
  ipcMain.handle('git:checkout', (_event, repoId, branch) => git.checkout(repoId, branch));
  ipcMain.handle('git:pull', (_event, repoId) => git.pull(repoId));

  // Dependency handlers (F4 / TC1). install streams stdout/stderr back to the same
  // renderer that requested it via deps:log, while the invoke result carries the final
  // status/error object.
  ipcMain.handle('deps:getStatus', (_event, repoId) => deps.getDependencyStatus(repoId));
  ipcMain.handle('deps:install', (event, repoId, options = {}) =>
    deps.installDeps(repoId, {
      force: Boolean(options.force),
      onOutput: (payload) => event.sender.send('deps:log', payload),
    })
  );

  // selfpointrest env handlers (F6 / TE1). Return metadata only: never .env contents.
  ipcMain.handle('env:getStatus', () => env.getSelfpointrestEnvStatus());
  ipcMain.handle('env:apply', (_event, envName) => env.applySelfpointrestEnv(envName));

  // Process orchestrator handlers (F7/F9/F10 — TF1). start/restart stream stdout/stderr
  // back to the requesting renderer via runner:log; the invoke result carries the final
  // serializable snapshot. All runner.* functions return plain objects and never throw.
  ipcMain.handle('runner:start', (event, repoId, options = {}) =>
    runner.start(repoId, {
      buildUIs: options.buildUIs,
      port: options.port,
      skipBuild: Boolean(options.skipBuild),
      force: Boolean(options.force), // TF2 — bypass the pre-start port-busy guard.
      onOutput: (payload) => event.sender.send('runner:log', payload),
    })
  );
  ipcMain.handle('runner:restart', (event, repoId, options = {}) =>
    runner.restart(repoId, {
      buildUIs: options.buildUIs,
      port: options.port,
      skipBuild: Boolean(options.skipBuild),
      force: Boolean(options.force),
      onOutput: (payload) => event.sender.send('runner:log', payload),
    })
  );
  // Port check (TF2). Lets the UI pre-flight a repo's effective port before Start and show
  // who likely holds it. Returns { repoId, port, busy, heldBy } — plain serializable data.
  ipcMain.handle('ports:check', (_event, repoId, options = {}) =>
    ports.checkRepoPort(repoId, { port: options.port })
  );

  // Indexer edits (F8 / TG1). Patch the indexer test fixtures (idempotent + backup) or open
  // them in the default editor. Restart goes through runner:restart (already wired above).
  // Inputs come from the renderer; results are plain serializable objects and never throw.
  // We never forward opts.filePath/opts.dir/opts.opener from the renderer — those are
  // TEST-ONLY hooks; the IPC layer always targets the real registry path.
  ipcMain.handle('indexer:openFiles', () => indexer.openTestFiles());
  ipcMain.handle('indexer:applyProducts', (_event, preset = {}) =>
    indexer.applyProductsPreset({ retailerId: preset.retailerId, productIds: preset.productIds })
  );
  ipcMain.handle('indexer:applySpecials', (_event, values = {}) =>
    indexer.applySpecialsConfig({ retailer: values.retailer, special: values.special })
  );

  // VPN handlers (F5 / TD1). All config (probeHost/probePort/exePath) comes from the
  // renderer — nothing is hardcoded. The native "Hãy đăng nhập VPN" Notification is fired
  // HERE (needs electron), not in vpn.js. Poll ticks stream back via vpn:tick.
  //
  // vpn:check — one-shot detection. Returns { connected, method, detail? }.
  ipcMain.handle('vpn:check', (_event, config = {}) =>
    vpn.isVpnConnected({
      probeHost: config.probeHost,
      probePort: config.probePort,
      timeoutMs: config.timeoutMs,
    })
  );

  // vpn:connect — if already connected, do nothing. Otherwise: launch openvpn-gui.exe (only
  // if it isn't already running) + fire the native Notification + start polling. The invoke
  // result reports what we did ({ ok, alreadyConnected, launch?, notified, polling }); the
  // poll's outcome arrives later via the final vpn:tick + the caller observing connected.
  ipcMain.handle('vpn:connect', async (event, config = {}) => {
    const probeConfig = {
      probeHost: config.probeHost,
      probePort: config.probePort,
      timeoutMs: config.timeoutMs,
    };

    const initial = await vpn.isVpnConnected(probeConfig);
    if (initial.connected) {
      return { ok: true, alreadyConnected: true, method: initial.method, detail: initial.detail };
    }

    // Launch the GUI only when it isn't already running (don't pop a second window).
    let launch = null;
    const running = await vpn.isOpenVpnGuiRunning();
    if (!running) {
      launch = await vpn.launchOpenVpnGui(config.exePath);
    } else {
      launch = { ok: true, launched: false, message: 'OpenVPN GUI is already running.' };
    }
    if (launch && launch.ok === false) {
      return {
        ok: false,
        alreadyConnected: false,
        launch,
        notified: false,
        polling: false,
        method: initial.method,
        message: launch.message,
      };
    }

    // Native notification — guard with isSupported() so headless/unsupported hosts are safe.
    let notified = false;
    try {
      if (Notification && Notification.isSupported && Notification.isSupported()) {
        new Notification({
          title: 'VPN',
          body: 'Hãy đăng nhập VPN',
        }).show();
        notified = true;
      }
    } catch (_err) {
      // Notification must never break the connect flow.
    }

    // Replace any previous poll, then start a fresh one. Ticks are streamed to the renderer
    // that initiated the connect; the final tick reflects connected/timeout/cancel.
    cancelVpnPoll();
    vpnPoll = vpn.waitForConnection(probeConfig, {
      intervalMs: config.intervalMs, // per-poll cadence (vpn.js default 2500ms)
      timeoutMs: config.pollTimeoutMs, // total poll budget (vpn.js default 120000ms)
      onTick: (tick) => event.sender.send('vpn:tick', tick),
    });
    vpnPoll.promise.then((outcome) => {
      vpnPoll = null;
      // Final summary tick so the UI can settle even if it missed the resolve.
      try {
        event.sender.send('vpn:tick', { ...outcome, final: true });
      } catch (_err) {
        // sender may be gone if the window closed — ignore.
      }
    });

    return {
      ok: true,
      alreadyConnected: false,
      launch,
      notified,
      polling: true,
      method: initial.method,
    };
  });

  // vpn:cancel — stop the in-flight poll (does NOT disconnect the VPN).
  ipcMain.handle('vpn:cancel', () => {
    const wasPolling = Boolean(vpnPoll);
    cancelVpnPoll();
    return { ok: true, cancelled: wasPolling };
  });

  ipcMain.handle('runner:stop', (_event, repoId) => runner.stop(repoId));
  ipcMain.handle('runner:status', (_event, repoId) => runner.getStatus(repoId));
  ipcMain.handle('runner:describe', (_event, repoId, options = {}) =>
    // Cherry-pick safe fields only (like start/restart) — never forward the test-only
    // commandOverride/cwd hooks from the renderer into the command preview.
    runner.describeRun(repoId, {
      buildUIs: options.buildUIs,
      port: options.port,
      skipBuild: Boolean(options.skipBuild),
    })
  );
}

module.exports = { setupIpc };
