'use strict';

// selfpointrest env layer (TE1).
// Applies prod/test by copying .env-prod/.env-test to .env, backing up the
// previous .env first, and ensuring clients_dir is present. Never returns or logs
// .env file contents.

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const fsConstants = require('node:fs').constants;
const path = require('node:path');
const { getRepo } = require('./repos');

const ENV_FILES = {
  prod: '.env-prod',
  test: '.env-test',
};

const ACTIVE_ENV_FILE = '.env';
const CLIENTS_DIR_LINE = 'clients_dir="../../public"';

function resolveSelfpointrestDir(options = {}) {
  if (options.selfpointrestDir) return options.selfpointrestDir;
  const repo = getRepo('selfpointrest');
  if (!repo || !repo.path) {
    throw new Error('selfpointrest repo is missing from the registry.');
  }
  return repo.path;
}

function validateEnvName(envName) {
  if (!Object.prototype.hasOwnProperty.call(ENV_FILES, envName)) {
    throw new Error('env must be "prod" or "test".');
  }
}

async function statOrNull(filePath) {
  try {
    return await fs.stat(filePath);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

async function requireFile(filePath, label) {
  const stat = await statOrNull(filePath);
  if (!stat) {
    throw new Error(`${label} does not exist: ${filePath}`);
  }
  if (!stat.isFile()) {
    throw new Error(`${label} is not a file: ${filePath}`);
  }
}

function backupTimestamp(now = new Date()) {
  return now.toISOString().replace(/[-:TZ.]/g, '');
}

async function nextBackupPath(dir) {
  const stamp = backupTimestamp();
  for (let i = 0; i < 100; i += 1) {
    const suffix = i === 0 ? '' : `-${i}`;
    const candidate = path.join(dir, `.env.bak-${stamp}${suffix}`);
    if (!(await statOrNull(candidate))) return candidate;
  }
  throw new Error('Could not find an available .env backup name.');
}

async function backupActiveEnv(dir) {
  const activePath = path.join(dir, ACTIVE_ENV_FILE);
  const activeStat = await statOrNull(activePath);
  if (!activeStat) return null;
  if (!activeStat.isFile()) {
    throw new Error(`Active env is not a file: ${activePath}`);
  }

  const backupPath = await nextBackupPath(dir);
  await fs.copyFile(activePath, backupPath, fsConstants.COPYFILE_EXCL);
  return {
    path: backupPath,
    name: path.basename(backupPath),
  };
}

function ensureClientsDirContent(input) {
  const eol = input.includes('\r\n') ? '\r\n' : '\n';
  const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const hadTrailingNewline = normalized.endsWith('\n');
  const rawLines = normalized.length === 0 ? [] : normalized.split('\n');
  if (hadTrailingNewline) rawLines.pop();

  let found = false;
  let changed = false;
  const lines = rawLines.map((line) => {
    if (/^\s*clients_dir\s*=/.test(line)) {
      found = true;
      if (line === CLIENTS_DIR_LINE) return line;
      changed = true;
      return CLIENTS_DIR_LINE;
    }
    return line;
  });

  if (!found) {
    lines.push(CLIENTS_DIR_LINE);
    changed = true;
  }

  const output = `${lines.join(eol)}${eol}`;
  return {
    content: output,
    changed: changed || output !== input,
    present: true,
  };
}

async function ensureClientsDir(filePath) {
  const original = await fs.readFile(filePath, 'utf8');
  const next = ensureClientsDirContent(original);
  if (next.changed) {
    await fs.writeFile(filePath, next.content, 'utf8');
  }
  return {
    present: next.present,
    changed: next.changed,
  };
}

async function normalizedHash(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const normalized = ensureClientsDirContent(content).content;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

async function detectActiveEnv(dir) {
  const activePath = path.join(dir, ACTIVE_ENV_FILE);
  const activeStat = await statOrNull(activePath);
  if (!activeStat || !activeStat.isFile()) return null;

  const activeHash = await normalizedHash(activePath);
  for (const [envName, fileName] of Object.entries(ENV_FILES)) {
    const sourcePath = path.join(dir, fileName);
    const sourceStat = await statOrNull(sourcePath);
    if (!sourceStat || !sourceStat.isFile()) continue;
    if ((await normalizedHash(sourcePath)) === activeHash) return envName;
  }
  return 'unknown';
}

async function hasRequiredClientsDir(dir) {
  const activePath = path.join(dir, ACTIVE_ENV_FILE);
  const activeStat = await statOrNull(activePath);
  if (!activeStat || !activeStat.isFile()) return false;
  const content = await fs.readFile(activePath, 'utf8');
  return content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .some((line) => line === CLIENTS_DIR_LINE);
}

async function getSelfpointrestEnvStatus(options = {}) {
  try {
    const dir = resolveSelfpointrestDir(options);
    const files = {};
    for (const [envName, fileName] of Object.entries(ENV_FILES)) {
      const stat = await statOrNull(path.join(dir, fileName));
      files[envName] = Boolean(stat && stat.isFile());
    }
    const activeStat = await statOrNull(path.join(dir, ACTIVE_ENV_FILE));
    files.active = Boolean(activeStat && activeStat.isFile());

    return {
      ok: true,
      env: await detectActiveEnv(dir),
      hasClientsDir: await hasRequiredClientsDir(dir),
      files,
      message: 'Env status loaded.',
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: (err && err.message) || String(err),
    };
  }
}

async function applySelfpointrestEnv(envName, options = {}) {
  try {
    validateEnvName(envName);
    const dir = resolveSelfpointrestDir(options);
    const sourceName = ENV_FILES[envName];
    const sourcePath = path.join(dir, sourceName);
    const activePath = path.join(dir, ACTIVE_ENV_FILE);

    await requireFile(sourcePath, sourceName);

    const backup = await backupActiveEnv(dir);
    await fs.copyFile(sourcePath, activePath);
    const clientsDir = await ensureClientsDir(activePath);

    return {
      ok: true,
      env: envName,
      backupCreated: Boolean(backup),
      backupName: backup ? backup.name : null,
      sourceName,
      activeName: ACTIVE_ENV_FILE,
      clientsDir,
      message: `env = ${envName}`,
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: (err && err.message) || String(err),
    };
  }
}

module.exports = {
  ACTIVE_ENV_FILE,
  CLIENTS_DIR_LINE,
  ENV_FILES,
  applySelfpointrestEnv,
  ensureClientsDirContent,
  getSelfpointrestEnvStatus,
};
