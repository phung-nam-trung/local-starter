'use strict';

// Repo registry — single source of truth for the 9 repos the launcher manages.
// UI-agnostic, NO secrets here (env/.env handling lives in env.js / TE1).
// Facts (path / commands / port / branch) are taken from ai/CONTEXT.md §3, §4, §8
// and re-verified against each repo's package.json / project.json on 2026-06-29.
//
// Every other task reads paths/commands from THIS file — do not hardcode paths elsewhere.

const path = require('node:path');

// The two workspace roots (CONTEXT §2). All repo paths derive from these.
const DEFAULT_WORKSPACE_ROOTS = Object.freeze({
  'sp-local-workspace': 'C:\\Users\\TrungPhung\\Downloads\\repositories\\sp-local-workspace',
  'new-frontend': 'C:\\Users\\TrungPhung\\Downloads\\repositories\\new-frontend',
});

const WORKSPACE_CONFIG_KEYS = {
  'sp-local-workspace': 'spLocalWorkspace',
  'new-frontend': 'newFrontend',
};

// Mutable in-place object kept for API compatibility with existing imports.
const WORKSPACES = { ...DEFAULT_WORKSPACE_ROOTS };

// Initial constants are used only to build the default array before refreshRepoPaths()
// applies the current roots. Later root changes mutate the exported repo objects in place.
const SP = DEFAULT_WORKSPACE_ROOTS['sp-local-workspace'];
const NF = DEFAULT_WORKSPACE_ROOTS['new-frontend'];

const SP_BRANCH = 'master'; // CONTEXT §4 — every sp-local-workspace repo
const NF_BRANCH = 'new-frontend-dev-prod'; // CONTEXT §4 — new-frontend

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function workspaceRootFrom(source, workspaceId) {
  if (!isPlainObject(source)) return null;
  const configKey = WORKSPACE_CONFIG_KEYS[workspaceId];
  return nonEmptyString(source[workspaceId]) || nonEmptyString(source[configKey]);
}

function resolveWorkspaceRoots(source) {
  const roots = isPlainObject(source) && isPlainObject(source.workspaceRoots)
    ? source.workspaceRoots
    : source;

  return {
    'sp-local-workspace':
      workspaceRootFrom(roots, 'sp-local-workspace') ||
      DEFAULT_WORKSPACE_ROOTS['sp-local-workspace'],
    'new-frontend':
      workspaceRootFrom(roots, 'new-frontend') || DEFAULT_WORKSPACE_ROOTS['new-frontend'],
  };
}

function getWorkspaceRoots() {
  return { ...WORKSPACES };
}

// Field contract per repo:
//   id              : stable identifier used by IPC / config
//   name            : human label
//   role            : short description
//   workspace       : 'sp-local-workspace' | 'new-frontend'
//   path            : absolute repo path
//   packageManager  : 'npm' | 'pnpm'
//   installCwd      : absolute dir where install runs
//   runCwd          : absolute dir where build/start run
//   buildCwd        : optional absolute dir for build-only/UI build commands
//   install         : install command
//   build           : build command, or null
//   start           : start/serve command, or null (build-only repos)
//   port            : default dev port, or null
//   defaultBranch   : preselected branch (CONTEXT §4)
//   needsVpn        : backend needs VPN for DB/ES (CONTEXT §9)
//   buildOnly       : true => no own server; served by another repo
//   servedBy        : { repo, route } when buildOnly via selfpointrest, else null
//   portConflictWith: array of repo ids sharing the same default port, or null
//   needsCodeEdit   : true => requires manual code edits before run (indexer, CONTEXT §7)
//   templates       : build variants (frontend kikar/prutah), or null
//   postinstallNote : human note about postinstall side-effects (CONTEXT §3 / §10)
const repos = [
  // --- sp-local-workspace: Backend (servers) — CONTEXT §3.1 ---
  {
    id: 'selfpointrest',
    name: 'selfpointrest',
    role: 'Backend chính + serve UI tĩnh đã build',
    workspace: 'sp-local-workspace',
    path: path.join(SP, 'servers', 'selfpointrest'),
    packageManager: 'npm',
    installCwd: path.join(SP, 'servers', 'selfpointrest'),
    runCwd: path.join(SP, 'servers', 'selfpointrest'),
    install: 'npm install', // postinstall runs `npm run buildAll`
    build: 'npm run buildAll', // npx gulp buildAll
    start: 'npm start', // node server.js
    port: 3000, // https on 3001
    defaultBranch: SP_BRANCH,
    needsVpn: true,
    buildOnly: false,
    servedBy: null,
    portConflictWith: null,
    needsCodeEdit: false,
    templates: null,
    postinstallNote: 'postinstall chạy `npm run buildAll`',
  },
  {
    id: 'loyalty',
    name: 'loyalty',
    role: 'Backend loyalty',
    workspace: 'sp-local-workspace',
    path: path.join(SP, 'servers', 'loyalty'),
    packageManager: 'npm',
    installCwd: path.join(SP, 'servers', 'loyalty'),
    runCwd: path.join(SP, 'servers', 'loyalty'),
    install: 'npm install',
    build: null,
    start: 'npm start', // node lib/server
    port: 4000,
    defaultBranch: SP_BRANCH,
    needsVpn: true,
    buildOnly: false,
    servedBy: null,
    portConflictWith: null, // token-service listens on 4001 via its .env — no clash
    needsCodeEdit: false,
    templates: null,
    postinstallNote: null,
  },
  {
    id: 'indexer-queue-subscriber',
    name: 'indexer-queue-subscriber',
    role: 'Indexer (Elasticsearch)',
    workspace: 'sp-local-workspace',
    path: path.join(SP, 'servers', 'indexer-queue-subscriber'),
    packageManager: 'npm',
    installCwd: path.join(SP, 'servers', 'indexer-queue-subscriber'),
    runCwd: path.join(SP, 'servers', 'indexer-queue-subscriber'),
    install: 'npm install',
    build: null,
    start: 'npm start', // node --max-old-space-size=3000 ./server.js
    port: 4002,
    defaultBranch: SP_BRANCH,
    needsVpn: true,
    buildOnly: false,
    servedBy: null,
    portConflictWith: null,
    needsCodeEdit: true, // edit test/products.js & test/specials.js before run (CONTEXT §7)
    templates: null,
    postinstallNote: null,
  },
  {
    id: 'token-service',
    name: 'token-service',
    role: 'Token service (TypeScript)',
    workspace: 'sp-local-workspace',
    path: path.join(SP, 'servers', 'token-service'),
    packageManager: 'npm',
    installCwd: path.join(SP, 'servers', 'token-service'),
    runCwd: path.join(SP, 'servers', 'token-service'),
    install: 'npm install',
    build: 'npm run build', // tsc -> dist/
    start: 'npm start', // cleanBuild && node dist/index.js
    port: 4001, // listens on 4001 via its own .env PORT (code default is 4000) — no clash with loyalty
    defaultBranch: SP_BRANCH,
    needsVpn: true,
    buildOnly: false,
    servedBy: null,
    portConflictWith: null,
    needsCodeEdit: false,
    templates: null,
    postinstallNote: null,
  },

  // --- sp-local-workspace: UI (public) — CONTEXT §3.2 ---
  // backend & frontend are build-only: selfpointrest serves their built output.
  {
    id: 'backend',
    name: 'backend (Back Office)',
    role: 'UI Back Office (AngularJS + Gulp)',
    workspace: 'sp-local-workspace',
    path: path.join(SP, 'public', 'backend'),
    packageManager: 'npm',
    installCwd: path.join(SP, 'public', 'backend'),
    // Built via the sp-local-workspace root builder; selfpointrest only serves the output.
    buildCwd: SP,
    runCwd: path.join(SP, 'servers', 'selfpointrest'),
    install: 'npm install', // postinstall runs `npx bower install`
    build: 'npm run build-backend', // root builder: node builder backend build -> build/backend
    start: null,
    port: null,
    defaultBranch: SP_BRANCH,
    needsVpn: false,
    buildOnly: true,
    servedBy: { repo: 'selfpointrest', route: '/backend' },
    portConflictWith: null,
    needsCodeEdit: false,
    templates: null,
    postinstallNote: 'postinstall chạy `npx bower install`',
  },
  {
    id: 'frontend',
    name: 'frontend',
    role: 'UI Frontend (AngularJS) — 2 template kikar/prutah',
    workspace: 'sp-local-workspace',
    path: path.join(SP, 'public', 'frontend'),
    packageManager: 'npm',
    installCwd: path.join(SP, 'public', 'frontend'),
    // Built via the sp-local-workspace root builder (per template).
    buildCwd: SP,
    runCwd: path.join(SP, 'servers', 'selfpointrest'),
    install: 'npm install', // postinstall runs `npx bower install --config.directory=libs`
    // No single build: TF1 builds per template from `templates` below.
    build: null,
    start: null,
    port: null,
    defaultBranch: SP_BRANCH,
    needsVpn: false,
    buildOnly: true,
    servedBy: { repo: 'selfpointrest', route: '/kikar | /prutah' },
    portConflictWith: null,
    needsCodeEdit: false,
    // Each template builds via the root builder and is served by selfpointrest.
    templates: [
      {
        id: 'kikar',
        name: 'Kikar',
        build: 'npm run build-kikar', // root builder: node builder frontend build -t kikar
        servedBy: { repo: 'selfpointrest', route: '/kikar' },
      },
      {
        id: 'prutah',
        name: 'Prutah',
        build: 'npm run build-prutah', // root builder: node builder frontend build -t prutah
        servedBy: { repo: 'selfpointrest', route: '/prutah' },
      },
    ],
    postinstallNote: 'postinstall chạy `npx bower install --config.directory=libs`',
  },
  // mobile & collection are standalone dev servers, both default 9000.
  {
    id: 'mobile',
    name: 'mobile',
    role: 'UI web mobile (AngularJS + Cordova)',
    workspace: 'sp-local-workspace',
    path: path.join(SP, 'public', 'mobile'),
    packageManager: 'npm',
    installCwd: path.join(SP, 'public', 'mobile'),
    runCwd: path.join(SP, 'public', 'mobile'),
    install: 'npm install', // postinstall runs `npx bower install`
    build: 'npm run build', // npx gulp web:build
    start: 'npm run serve', // npx gulp web:serve
    port: 9000,
    defaultBranch: SP_BRANCH,
    needsVpn: false,
    buildOnly: false,
    servedBy: null,
    portConflictWith: ['collection'], // both default 9000 (CONTEXT §8)
    needsCodeEdit: false,
    templates: null,
    postinstallNote: 'postinstall chạy `npx bower install`',
  },
  {
    id: 'collection',
    name: 'collection',
    role: 'UI collection (AngularJS + Cordova)',
    workspace: 'sp-local-workspace',
    path: path.join(SP, 'public', 'collection'),
    packageManager: 'npm',
    installCwd: path.join(SP, 'public', 'collection'),
    runCwd: path.join(SP, 'public', 'collection'),
    install: 'npm install', // postinstall runs `npx bower install`
    build: 'npm run build', // npx gulp web:build
    start: 'npm run serve', // npx gulp web:serve
    port: 9000,
    defaultBranch: SP_BRANCH,
    needsVpn: false,
    buildOnly: false,
    servedBy: null,
    portConflictWith: ['mobile'], // both default 9000 (CONTEXT §8)
    needsCodeEdit: false,
    templates: null,
    postinstallNote: 'postinstall chạy `npx bower install`',
  },

  // --- new-frontend — CONTEXT §3.3 ---
  // pnpm install + nx commands run from the new-frontend ROOT, not apps/stor-web.
  {
    id: 'stor-web',
    name: 'stor-web',
    role: 'New UI mobile (Next.js, Nx)',
    workspace: 'new-frontend',
    path: path.join(NF, 'apps', 'stor-web'),
    packageManager: 'pnpm',
    installCwd: NF, // root monorepo (CONTEXT §3.3 note)
    runCwd: NF, // nx runs from root
    install: 'pnpm install', // runs Husky on install (CONTEXT §10)
    build: 'pnpm nx build stor-web',
    start: 'pnpm nx serve stor-web',
    port: 3002,
    defaultBranch: NF_BRANCH,
    needsVpn: false,
    buildOnly: false,
    servedBy: null,
    portConflictWith: null,
    needsCodeEdit: false,
    templates: null,
    postinstallNote: 'pnpm install chạy Husky',
  },
];

const REPO_PATHS = {
  selfpointrest: {
    workspace: 'sp-local-workspace',
    path: ['servers', 'selfpointrest'],
    installCwd: ['servers', 'selfpointrest'],
    runCwd: ['servers', 'selfpointrest'],
  },
  loyalty: {
    workspace: 'sp-local-workspace',
    path: ['servers', 'loyalty'],
    installCwd: ['servers', 'loyalty'],
    runCwd: ['servers', 'loyalty'],
  },
  'indexer-queue-subscriber': {
    workspace: 'sp-local-workspace',
    path: ['servers', 'indexer-queue-subscriber'],
    installCwd: ['servers', 'indexer-queue-subscriber'],
    runCwd: ['servers', 'indexer-queue-subscriber'],
  },
  'token-service': {
    workspace: 'sp-local-workspace',
    path: ['servers', 'token-service'],
    installCwd: ['servers', 'token-service'],
    runCwd: ['servers', 'token-service'],
  },
  backend: {
    workspace: 'sp-local-workspace',
    path: ['public', 'backend'],
    installCwd: ['public', 'backend'],
    buildCwd: [],
    runCwd: ['servers', 'selfpointrest'],
  },
  frontend: {
    workspace: 'sp-local-workspace',
    path: ['public', 'frontend'],
    installCwd: ['public', 'frontend'],
    buildCwd: [],
    runCwd: ['servers', 'selfpointrest'],
  },
  mobile: {
    workspace: 'sp-local-workspace',
    path: ['public', 'mobile'],
    installCwd: ['public', 'mobile'],
    runCwd: ['public', 'mobile'],
  },
  collection: {
    workspace: 'sp-local-workspace',
    path: ['public', 'collection'],
    installCwd: ['public', 'collection'],
    runCwd: ['public', 'collection'],
  },
  'stor-web': {
    workspace: 'new-frontend',
    path: ['apps', 'stor-web'],
    installCwd: [],
    runCwd: [],
  },
};

function workspacePath(workspaceId, parts) {
  return path.join(WORKSPACES[workspaceId], ...parts);
}

function refreshRepoPaths() {
  repos.forEach((repo) => {
    const spec = REPO_PATHS[repo.id];
    if (!spec) return;
    repo.path = workspacePath(spec.workspace, spec.path);
    repo.installCwd = workspacePath(spec.workspace, spec.installCwd);
    repo.runCwd = workspacePath(spec.workspace, spec.runCwd);
    if (spec.buildCwd) {
      repo.buildCwd = workspacePath(spec.workspace, spec.buildCwd);
    }
  });
  return repos;
}

function setWorkspaceRoots(rootsOrConfig) {
  const nextRoots = resolveWorkspaceRoots(rootsOrConfig);
  WORKSPACES['sp-local-workspace'] = nextRoots['sp-local-workspace'];
  WORKSPACES['new-frontend'] = nextRoots['new-frontend'];
  refreshRepoPaths();
  return getWorkspaceRoots();
}

function setWorkspaceRootsForTest(rootsOrConfig) {
  return setWorkspaceRoots(rootsOrConfig);
}

function getRepo(id) {
  return repos.find((r) => r.id === id) || null;
}

refreshRepoPaths();

module.exports = repos;
module.exports.repos = repos;
module.exports.DEFAULT_WORKSPACE_ROOTS = DEFAULT_WORKSPACE_ROOTS;
module.exports.WORKSPACES = WORKSPACES;
module.exports.getWorkspaceRoots = getWorkspaceRoots;
module.exports.resolveWorkspaceRoots = resolveWorkspaceRoots;
module.exports.setWorkspaceRoots = setWorkspaceRoots;
module.exports.setWorkspaceRootsForTest = setWorkspaceRootsForTest;

// Lookup helper reused by later tasks (git/deps/runner) — avoids re-scanning the array.
module.exports.getRepo = getRepo;
