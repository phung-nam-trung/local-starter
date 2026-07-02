'use strict';

// Dependency install layer (TC1).
// Detects missing/stale node_modules from the install cwd and lockfile mtimes, then
// runs npm/pnpm with streamed stdout/stderr. No node_modules deletion happens here;
// "force reinstall" means "run install even when the status is current".

const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { getRepo, getWorkspaceRoots } = require('./repos');
const platform = require('./platform');

const LOCKFILES_BY_PM = {
  npm: ['package-lock.json', 'npm-shrinkwrap.json'],
  pnpm: ['pnpm-lock.yaml'],
};

const INSTALL_TARGETS = Object.freeze({
  SP_WORKSPACE_ROOT: 'sp-local-workspace-root',
});

const activeInstalls = new Map();

function commandFor(packageManager) {
  return platform.pmCommand(packageManager);
}

function getSpWorkspaceRootTarget() {
  const roots = getWorkspaceRoots();
  return {
    id: INSTALL_TARGETS.SP_WORKSPACE_ROOT,
    name: 'sp-local-workspace root',
    workspace: 'sp-local-workspace',
    packageManager: 'npm',
    installCwd: roots['sp-local-workspace'],
    install: 'npm install',
    hidden: true,
    postinstallNote: 'required by root builder scripts build-backend/build-kikar/build-prutah',
  };
}

function getDependencyTarget(targetId) {
  return getRepo(targetId) || (targetId === INSTALL_TARGETS.SP_WORKSPACE_ROOT
    ? getSpWorkspaceRootTarget()
    : null);
}

async function statOrNull(filePath) {
  try {
    return await fs.stat(filePath);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

function serializeFileStat(filePath, stat) {
  return {
    path: filePath,
    name: path.basename(filePath),
    mtimeMs: stat.mtimeMs,
    mtime: stat.mtime.toISOString(),
  };
}

async function getLockfiles(installCwd, packageManager) {
  const names = LOCKFILES_BY_PM[packageManager] || [];
  const files = [];
  for (const name of names) {
    const filePath = path.join(installCwd, name);
    const stat = await statOrNull(filePath);
    if (stat) files.push(serializeFileStat(filePath, stat));
  }
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function baseStatus(repo, installCwd, nodeModulesPath, lockfiles) {
  return {
    repoId: repo.id || null,
    packageManager: repo.packageManager,
    installCwd,
    nodeModulesPath,
    lockfiles,
    needed: false,
    reason: 'current',
    message: 'Dependencies look current.',
  };
}

async function getDependencyStatusForRepo(repo) {
  if (!repo || !repo.id) {
    throw new Error('getDependencyStatusForRepo: repo is required.');
  }
  if (!repo.installCwd) {
    throw new Error(`Repo ${repo.id} has no installCwd.`);
  }
  if (!repo.packageManager) {
    throw new Error(`Repo ${repo.id} has no packageManager.`);
  }

  const installCwd = repo.installCwd;
  const installCwdStat = await statOrNull(installCwd);
  if (!installCwdStat || !installCwdStat.isDirectory()) {
    throw new Error(`Install cwd does not exist for ${repo.id}: ${installCwd}`);
  }

  const nodeModulesPath = path.join(installCwd, 'node_modules');
  const [nodeModulesStat, lockfiles] = await Promise.all([
    statOrNull(nodeModulesPath),
    getLockfiles(installCwd, repo.packageManager),
  ]);

  const status = baseStatus(repo, installCwd, nodeModulesPath, lockfiles);

  if (!nodeModulesStat) {
    return {
      ...status,
      needed: true,
      reason: 'missing-node-modules',
      message: '`node_modules` is missing.',
    };
  }

  status.nodeModulesMtimeMs = nodeModulesStat.mtimeMs;
  status.nodeModulesMtime = nodeModulesStat.mtime.toISOString();

  if (lockfiles.length === 0) {
    const packageJsonPath = path.join(installCwd, 'package.json');
    const packageJsonStat = await statOrNull(packageJsonPath);
    if (packageJsonStat && packageJsonStat.mtimeMs > nodeModulesStat.mtimeMs + 1) {
      return {
        ...status,
        needed: true,
        reason: 'stale-package-json',
        packageJson: serializeFileStat(packageJsonPath, packageJsonStat),
        message: '`package.json` is newer than `node_modules` (no lockfile found).',
      };
    }
    return {
      ...status,
      reason: 'current-no-lockfile',
      message: 'No lockfile found; `node_modules` exists.',
    };
  }

  const newestLockfile = lockfiles[0];
  if (newestLockfile.mtimeMs > nodeModulesStat.mtimeMs + 1) {
    return {
      ...status,
      needed: true,
      reason: 'stale-lockfile',
      newestLockfile,
      message: `${newestLockfile.name} is newer than node_modules.`,
    };
  }

  return status;
}

async function getDependencyStatus(repoId) {
  const repo = getDependencyTarget(repoId);
  if (!repo) {
    return {
      ok: false,
      reason: 'unknown-target',
      message: `Unknown dependency target: ${repoId}`,
    };
  }
  try {
    return { ok: true, status: await getDependencyStatusForRepo(repo) };
  } catch (err) {
    return {
      ok: false,
      repoId: repo.id,
      packageManager: repo.packageManager,
      installCwd: repo.installCwd,
      reason: 'error',
      message: (err && err.message) || String(err),
    };
  }
}

function getInstallPlanForRepo(repo) {
  if (!repo || !repo.id) {
    throw new Error('getInstallPlanForRepo: repo is required.');
  }
  if (!repo.installCwd) {
    throw new Error(`Repo ${repo.id} has no installCwd.`);
  }

  const command = commandFor(repo.packageManager);
  return {
    repoId: repo.id,
    packageManager: repo.packageManager,
    command,
    args: ['install'],
    cwd: repo.installCwd,
    display: `${repo.packageManager} install`,
  };
}

function appendTail(current, chunk) {
  const next = `${current}${chunk}`;
  return next.length > 16000 ? next.slice(next.length - 16000) : next;
}

function emit(onOutput, payload) {
  if (typeof onOutput !== 'function') return;
  try {
    onOutput({
      timestamp: new Date().toISOString(),
      ...payload,
    });
  } catch (_err) {
    // Log listeners must never break the install process.
  }
}

function failureHint(repo, outputTail) {
  const lower = outputTail.toLowerCase();
  const hints = [];

  if (lower.includes('husky') || (repo.packageManager === 'pnpm' && lower.includes('prepare'))) {
    hints.push(
      'Husky/prepare may have failed. Check the log above, then retry; if this is a local hook setup issue, fix Husky in the repo before retrying.'
    );
  }
  if (lower.includes('bower')) {
    hints.push(
      'Bower postinstall may have failed. Check bower/network credentials, then retry the install.'
    );
  }
  if (
    lower.includes('postinstall') ||
    lower.includes('elifecycle') ||
    lower.includes('buildall') ||
    lower.includes('gulp')
  ) {
    hints.push(
      'A lifecycle/postinstall script may have failed. Review the streamed output, then use Retry or Force reinstall after fixing the root cause.'
    );
  }
  if (lower.includes('enoent') || lower.includes('not recognized')) {
    hints.push(
      `${repo.packageManager} may be missing from PATH. Install/enable it (pnpm usually via corepack), reopen the app, then retry.`
    );
  }
  if (hints.length === 0 && repo.postinstallNote) {
    hints.push(`This repo has install side effects: ${repo.postinstallNote}. Retry after checking that step.`);
  }
  if (hints.length === 0) {
    hints.push('Retry after fixing the error shown in the install log.');
  }

  return hints.join(' ');
}

function spawnInstall(repo, plan, onOutput) {
  return new Promise((resolve) => {
    let outputTail = '';
    let settled = false;

    function finish(result) {
      if (settled) return;
      settled = true;
      resolve(result);
    }

    emit(onOutput, {
      repoId: repo.id,
      stream: 'status',
      text: `Starting ${plan.display} in ${plan.cwd}\n`,
    });

    let child;
    try {
      child = spawn(plan.command, plan.args, {
        cwd: plan.cwd,
        env: { ...process.env, FORCE_COLOR: '0' },
        windowsHide: true,
        // npm.cmd/pnpm.cmd are shell scripts on Windows; using the platform shell keeps
        // the fixed command compatible while cwd still protects paths with spaces.
        shell: platform.isWin,
      });
    } catch (err) {
      const message = (err && err.message) || String(err);
      emit(onOutput, { repoId: repo.id, stream: 'stderr', text: `${message}\n` });
      finish({
        ok: false,
        reason: 'spawn-error',
        message,
        hint: failureHint(repo, outputTail || message),
      });
      return;
    }

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      outputTail = appendTail(outputTail, text);
      emit(onOutput, { repoId: repo.id, stream: 'stdout', text });
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      outputTail = appendTail(outputTail, text);
      emit(onOutput, { repoId: repo.id, stream: 'stderr', text });
    });

    child.on('error', (err) => {
      const message =
        err && err.code === 'ENOENT'
          ? `${plan.command} not found. Ensure ${repo.packageManager} is installed/enabled and available in PATH.`
          : (err && err.message) || String(err);
      emit(onOutput, { repoId: repo.id, stream: 'stderr', text: `${message}\n` });
      finish({
        ok: false,
        reason: 'spawn-error',
        message,
        hint: failureHint(repo, outputTail || message),
      });
    });

    child.on('close', (code, signal) => {
      if (code === 0) {
        emit(onOutput, {
          repoId: repo.id,
          stream: 'status',
          text: `${plan.display} completed successfully.\n`,
        });
        finish({ ok: true, code, signal, message: `${plan.display} completed successfully.` });
        return;
      }

      const message =
        signal == null
          ? `${plan.display} failed with exit code ${code}.`
          : `${plan.display} stopped by signal ${signal}.`;
      emit(onOutput, { repoId: repo.id, stream: 'stderr', text: `${message}\n` });
      finish({
        ok: false,
        reason: 'install-failed',
        code,
        signal,
        message,
        hint: failureHint(repo, outputTail),
      });
    });
  });
}

async function installDeps(repoId, options = {}) {
  const repo = getDependencyTarget(repoId);
  if (!repo) {
    return {
      ok: false,
      reason: 'unknown-target',
      message: `Unknown dependency target: ${repoId}`,
    };
  }

  return installDepsForRepo(repo, options);
}

async function installDepsForRepo(repo, options = {}) {
  if (activeInstalls.has(repo.id)) {
    return {
      ok: false,
      reason: 'busy',
      message: `Install is already running for ${repo.id}.`,
    };
  }

  let status;
  let plan;
  try {
    status = await getDependencyStatusForRepo(repo);
    plan = getInstallPlanForRepo(repo);
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: (err && err.message) || String(err),
    };
  }

  const force = Boolean(options.force);
  if (!force && !status.needed) {
    return {
      ok: true,
      skipped: true,
      status,
      plan,
      message: 'Dependencies are current; install skipped. Use Force reinstall to run install anyway.',
    };
  }

  activeInstalls.set(repo.id, true);
  try {
    const result = await spawnInstall(repo, plan, options.onOutput);
    const nextStatus = await getDependencyStatusForRepo(repo).catch(() => null);
    return { ...result, skipped: false, forced: force, status: nextStatus, plan };
  } finally {
    activeInstalls.delete(repo.id);
  }
}

module.exports = {
  INSTALL_TARGETS,
  getDependencyTarget,
  getDependencyStatus,
  getDependencyStatusForRepo,
  getInstallPlanForRepo,
  installDeps,
  installDepsForRepo,
};
