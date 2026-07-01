'use strict';

// Config store layer (F12 / TI1) — UI-agnostic, pure Node (NO electron import, so it can be
// tested from the CLI). The caller (ipc.js) decides WHERE the file lives (userData path) and
// passes the absolute path in; this module only reads/writes JSON.
//
// What we persist = the user's CHOICES only (which repos/branch/env/port overrides/VPN probe
// host), never secrets or .env contents (CONTEXT §10). The VPN probe host is a connection
// hint the user types — not a credential.
//
// load(filePath)  -> parsed config merged (shallow) over DEFAULT_CONFIG. Missing file or bad
//                    JSON returns the defaults instead of throwing, so a corrupt/absent config
//                    can never crash app startup.
// save(filePath, config) -> writes pretty JSON, creating the parent dir if needed, atomic-ish
//                    (write a temp file then rename). Returns { ok } and never logs contents.

const fs = require('node:fs');
const path = require('node:path');

const ROOT_KINDS = {
  sp: 'sp',
  'sp-local-workspace': 'sp',
  spLocalWorkspace: 'sp',
  nf: 'nf',
  'new-frontend': 'nf',
  newFrontend: 'nf',
};

// Shape of a fresh config. Kept flat + JSON-serializable. Nested objects (branchByRepo,
// portOverrideByRepo, vpn) are merged shallowly on load — see mergeConfig.
const DEFAULT_CONFIG = {
  selectedRepoIds: [],
  activeRepoId: null,
  branchByRepo: {},
  env: 'prod',
  portOverrideByRepo: {},
  workspaceRoots: { spLocalWorkspace: '', newFrontend: '' },
  // exePath kept for back-compat (old Windows-only field); clientPath/clientArgs are the
  // cross-platform VPN client config read by vpn.js launchVpnClient (TK6).
  vpn: { probeHost: '', probePort: null, exePath: '', clientPath: '', clientArgs: [] },
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeRootKind(kind) {
  return ROOT_KINDS[kind] || null;
}

function statOrNull(targetPath) {
  try {
    return fs.statSync(targetPath);
  } catch (_err) {
    return null;
  }
}

function isDirectory(targetPath) {
  const stat = statOrNull(targetPath);
  return Boolean(stat && stat.isDirectory());
}

function isFile(targetPath) {
  const stat = statOrNull(targetPath);
  return Boolean(stat && stat.isFile());
}

function validateSpRoot(rootDir) {
  const markers = {
    'servers/selfpointrest': isDirectory(path.join(rootDir, 'servers', 'selfpointrest')),
    public: isDirectory(path.join(rootDir, 'public')),
  };
  const missing = Object.entries(markers)
    .filter(([, exists]) => !exists)
    .map(([marker]) => marker);

  return {
    valid: missing.length === 0,
    markers,
    missing,
  };
}

function validateNfRoot(rootDir) {
  const storWeb = isDirectory(path.join(rootDir, 'apps', 'stor-web'));
  const nxJson = isFile(path.join(rootDir, 'nx.json'));
  const pnpmLock = isFile(path.join(rootDir, 'pnpm-lock.yaml'));
  const missing = [];

  if (!storWeb) missing.push('apps/stor-web');
  if (!nxJson && !pnpmLock) missing.push('nx.json or pnpm-lock.yaml');

  return {
    valid: storWeb && (nxJson || pnpmLock),
    markers: {
      'apps/stor-web': storWeb,
      'nx.json': nxJson,
      'pnpm-lock.yaml': pnpmLock,
    },
    missing,
  };
}

function validateRoot(kind, dir) {
  const normalizedKind = normalizeRootKind(kind);
  const trimmedDir = nonEmptyString(dir) || '';

  if (!normalizedKind) {
    return {
      kind,
      dir: trimmedDir,
      valid: false,
      reason: 'invalid-kind',
      message: 'kind must be sp or nf.',
    };
  }

  if (!trimmedDir) {
    return {
      kind: normalizedKind,
      dir: '',
      valid: false,
      reason: 'missing',
      message: 'workspace root is missing.',
    };
  }

  const absoluteDir = path.resolve(trimmedDir);
  if (!isDirectory(absoluteDir)) {
    return {
      kind: normalizedKind,
      dir: absoluteDir,
      valid: false,
      reason: 'missing',
      message: 'workspace root does not exist or is not a directory.',
    };
  }

  const markerCheck = normalizedKind === 'sp' ? validateSpRoot(absoluteDir) : validateNfRoot(absoluteDir);
  if (!markerCheck.valid) {
    return {
      kind: normalizedKind,
      dir: absoluteDir,
      valid: false,
      reason: 'missing-markers',
      markers: markerCheck.markers,
      missing: markerCheck.missing,
      message: `missing required marker(s): ${markerCheck.missing.join(', ')}.`,
    };
  }

  return {
    kind: normalizedKind,
    dir: absoluteDir,
    valid: true,
    reason: null,
    markers: markerCheck.markers,
    missing: [],
    message: 'ok',
  };
}

// Build a fresh defaults object every call so callers never share/mutate the same nested
// objects (branchByRepo, vpn, ...).
function freshDefault() {
  return {
    selectedRepoIds: [],
    activeRepoId: null,
    branchByRepo: {},
    env: 'prod',
    portOverrideByRepo: {},
    workspaceRoots: { ...DEFAULT_CONFIG.workspaceRoots },
    vpn: { ...DEFAULT_CONFIG.vpn },
  };
}

// Shallow merge of a loaded object over the defaults: top-level keys are taken from `loaded`
// when present, and the `vpn` slice is merged one level deeper so an old config missing a new
// vpn field (e.g. exePath) still resolves safely. Unknown extra keys in `loaded` are dropped.
function mergeConfig(loaded) {
  const base = freshDefault();
  if (!isPlainObject(loaded)) return base;

  if (Array.isArray(loaded.selectedRepoIds)) base.selectedRepoIds = loaded.selectedRepoIds;
  if (typeof loaded.activeRepoId === 'string' || loaded.activeRepoId === null) {
    base.activeRepoId = loaded.activeRepoId;
  }
  if (isPlainObject(loaded.branchByRepo)) base.branchByRepo = loaded.branchByRepo;
  if (loaded.env === 'prod' || loaded.env === 'test') base.env = loaded.env;
  if (isPlainObject(loaded.portOverrideByRepo)) base.portOverrideByRepo = loaded.portOverrideByRepo;
  if (isPlainObject(loaded.workspaceRoots)) {
    base.workspaceRoots = { ...base.workspaceRoots, ...loaded.workspaceRoots };
  }
  if (isPlainObject(loaded.vpn)) base.vpn = { ...base.vpn, ...loaded.vpn };

  return base;
}

// Read + parse the config file. Any failure (missing file, unreadable, invalid JSON) returns
// the merged defaults — load never throws and never logs file contents.
function load(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return mergeConfig(JSON.parse(raw));
  } catch (_err) {
    // ENOENT (no file yet) or SyntaxError (corrupt JSON) — fall back to defaults silently.
    return freshDefault();
  }
}

// Write the config as pretty JSON. Creates the parent directory if missing, and writes to a
// temp file then renames over the target so a crash mid-write can't leave a half-written
// config. Returns { ok } (with reason/message on failure) instead of throwing.
function save(filePath, config) {
  try {
    if (!isPlainObject(config)) {
      return { ok: false, reason: 'invalid', message: 'config must be a plain object.' };
    }
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });

    const json = `${JSON.stringify(config, null, 2)}\n`;
    const tmpPath = `${filePath}.tmp-${process.pid}`;
    fs.writeFileSync(tmpPath, json, 'utf8');
    fs.renameSync(tmpPath, filePath);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'error', message: (err && err.message) || String(err) };
  }
}

module.exports = {
  DEFAULT_CONFIG,
  load,
  save,
  validateRoot,
};
