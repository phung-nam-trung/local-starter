'use strict';

const { ipcMain } = require('electron');
const repos = require('./orchestrator/repos');
const git = require('./orchestrator/git');
const deps = require('./orchestrator/deps');
const env = require('./orchestrator/env');

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
}

module.exports = { setupIpc };
