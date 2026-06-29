'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Safe bridge. contextIsolation stays on; the renderer only sees what we explicitly
// expose here. We expose named functions per channel — never the raw ipcRenderer.
contextBridge.exposeInMainWorld('launcher', {
  version: '0.1.0',
  // F1 / TA2 — return the repo registry (metadata only).
  listRepos: () => ipcRenderer.invoke('repos:list'),
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
    status: (repoId) => ipcRenderer.invoke('runner:status', repoId),
    describe: (repoId, options) => ipcRenderer.invoke('runner:describe', repoId, options),
    onLog: (handler) => {
      const listener = (_event, payload) => handler(payload);
      ipcRenderer.on('runner:log', listener);
      return () => ipcRenderer.removeListener('runner:log', listener);
    },
  },
});
