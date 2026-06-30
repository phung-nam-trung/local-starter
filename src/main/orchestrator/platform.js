'use strict';

const { spawn } = require('node:child_process');

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

module.exports = {
  isWin,
  isMac,
  isLinux,
  pmCommand,
  openPath,
};
