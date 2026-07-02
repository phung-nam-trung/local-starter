'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Safe bridge. contextIsolation stays on; the renderer only sees what we explicitly
// expose here. We expose named functions per channel — never the raw ipcRenderer.
contextBridge.exposeInMainWorld('launcher', {
  version: '0.1.0',
  // F1 / TA2 — return the repo registry (metadata only).
  listRepos: () => ipcRenderer.invoke('repos:list'),
  workspace: {
    getRoots: () => ipcRenderer.invoke('workspace:getRoots'),
    setRoots: (roots) => ipcRenderer.invoke('workspace:setRoots', roots),
    pickFolder: (options) => ipcRenderer.invoke('workspace:pickFolder', options),
  },
  // F2/F3 — git info + safe mutating ops per repo.
  //   TB1 (read-only): listBranches / currentBranch / isClean.
  //   TB2 (mutating):  fetch / checkout / pull — return { ok, reason?, branch?, message };
  //                    checkout/pull refuse a dirty tree (reason:'dirty').
  git: {
    listBranches: (repoId) => ipcRenderer.invoke('git:listBranches', repoId),
    currentBranch: (repoId) => ipcRenderer.invoke('git:currentBranch', repoId),
    isClean: (repoId) => ipcRenderer.invoke('git:isClean', repoId),
    fetch: (repoId) => ipcRenderer.invoke('git:fetch', repoId),
    checkout: (repoId, branch) => ipcRenderer.invoke('git:checkout', repoId, branch),
    pull: (repoId) => ipcRenderer.invoke('git:pull', repoId),
    previewLocalChanges: (repoId, options) =>
      ipcRenderer.invoke('git:previewLocalChanges', repoId, options),
    resetTrackedChanges: (repoId, confirmation) =>
      ipcRenderer.invoke('git:resetTrackedChanges', repoId, confirmation),
    discardAllLocalChanges: (repoId, confirmation) =>
      ipcRenderer.invoke('git:discardAllLocalChanges', repoId, confirmation),
  },
  deps: {
    getStatus: (repoId) => ipcRenderer.invoke('deps:getStatus', repoId),
    install: (repoId, options) => ipcRenderer.invoke('deps:install', repoId, options),
    onLog: (handler) => {
      const listener = (_event, payload) => handler(payload);
      ipcRenderer.on('deps:log', listener);
      return () => ipcRenderer.removeListener('deps:log', listener);
    },
  },
  env: {
    getStatus: () => ipcRenderer.invoke('env:getStatus'),
    apply: (envName) => ipcRenderer.invoke('env:apply', envName),
  },
  // F7/F9/F10 — process orchestrator (TF1). start/restart return a serializable snapshot
  // and stream stdout/stderr via onLog (same subscribe/unsubscribe pattern as deps).
  runner: {
    start: (repoId, options) => ipcRenderer.invoke('runner:start', repoId, options),
    restart: (repoId, options) => ipcRenderer.invoke('runner:restart', repoId, options),
    stop: (repoId) => ipcRenderer.invoke('runner:stop', repoId),
    // TH2 / F9 — Stop all active repos at once. Returns { ok, stopped:[repoId...], results }.
    stopAll: () => ipcRenderer.invoke('runner:stopAll'),
    status: (repoId) => ipcRenderer.invoke('runner:status', repoId),
    // TH1 — one snapshot for every repo (status table dashboard). In-memory, cheap to poll.
    statusAll: () => ipcRenderer.invoke('runner:statusAll'),
    describe: (repoId, options) => ipcRenderer.invoke('runner:describe', repoId, options),
    onLog: (handler) => {
      const listener = (_event, payload) => handler(payload);
      ipcRenderer.on('runner:log', listener);
      return () => ipcRenderer.removeListener('runner:log', listener);
    },
  },
  // TF2 — pre-flight a repo's effective port. Returns { repoId, port, busy, heldBy }.
  ports: {
    check: (repoId, options) => ipcRenderer.invoke('ports:check', repoId, options),
  },
  // F8 / TG1 — indexer test-file helpers. openFiles opens products.js/specials.js in the
  // default editor; applyProducts/applySpecials patch the fixtures (idempotent + backup) and
  // return { ok, changed, backupName, target, message }. Restart uses runner.restart above.
  indexer: {
    openFiles: () => ipcRenderer.invoke('indexer:openFiles'),
    applyProducts: (preset) => ipcRenderer.invoke('indexer:applyProducts', preset),
    applySpecials: (values) => ipcRenderer.invoke('indexer:applySpecials', values),
    // TG2 — REST-only: read/flip the commented state of queue.subscribe() in server.js.
    // Returns { ok, found, restOnly, ... } / { ok, changed, restOnly, backupName, message }.
    getRestOnly: () => ipcRenderer.invoke('indexer:getRestOnly'),
    setRestOnly: (enabled) => ipcRenderer.invoke('indexer:setRestOnly', enabled),
  },
  // F5 / TD1 — VPN detect + connect + poll. check returns { connected, method, detail? };
  // connect launches OpenVPN GUI (if needed) + fires the native notification + starts a
  // poll that streams ticks via onTick (same subscribe/unsubscribe pattern as deps/runner).
  vpn: {
    check: (config) => ipcRenderer.invoke('vpn:check', config),
    connect: (config) => ipcRenderer.invoke('vpn:connect', config),
    cancel: () => ipcRenderer.invoke('vpn:cancel'),
    onTick: (handler) => {
      const listener = (_event, payload) => handler(payload);
      ipcRenderer.on('vpn:tick', listener);
      return () => ipcRenderer.removeListener('vpn:tick', listener);
    },
  },
  // F12 / TI1 — persist & restore the user's choices (repos/branch/env/port override/VPN
  // client path/args). The file path lives in userData and is resolved in main — the renderer only
  // gets/sets the config object. load returns the merged config; save returns { ok }.
  config: {
    load: () => ipcRenderer.invoke('config:load'),
    save: (config) => ipcRenderer.invoke('config:save', config),
  },
});
