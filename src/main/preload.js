'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Safe bridge. contextIsolation stays on; the renderer only sees what we explicitly
// expose here. We expose named functions per channel — never the raw ipcRenderer.
contextBridge.exposeInMainWorld('launcher', {
  version: '0.1.0',
  // F1 / TA2 — return the repo registry (metadata only).
  listRepos: () => ipcRenderer.invoke('repos:list'),
  // F2/F3 / TB1 — read-only git info per repo (no checkout/pull/fetch here; that's TB2).
  git: {
    listBranches: (repoId) => ipcRenderer.invoke('git:listBranches', repoId),
    currentBranch: (repoId) => ipcRenderer.invoke('git:currentBranch', repoId),
    isClean: (repoId) => ipcRenderer.invoke('git:isClean', repoId),
  },
});
