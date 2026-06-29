'use strict';

const { ipcMain } = require('electron');
const repos = require('./orchestrator/repos');
const git = require('./orchestrator/git');

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
}

module.exports = { setupIpc };
