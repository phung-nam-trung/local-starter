'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Safe bridge. contextIsolation stays on; the renderer only sees what we explicitly
// expose here. We expose named functions per channel — never the raw ipcRenderer.
contextBridge.exposeInMainWorld('launcher', {
  version: '0.1.0',
  // F1 / TA2 — return the repo registry (metadata only).
  listRepos: () => ipcRenderer.invoke('repos:list'),
});
