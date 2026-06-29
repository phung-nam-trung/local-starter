'use strict';

// Repo registry — single source of truth for the 9 repos the launcher manages.
// UI-agnostic, NO secrets here (env/.env handling lives in env.js / TE1).
// Facts (path / commands / port / branch) are taken from ai/CONTEXT.md §3, §4, §8
// and re-verified against each repo's package.json / project.json on 2026-06-29.
//
// Every other task reads paths/commands from THIS file — do not hardcode paths elsewhere.

const path = require('node:path');

// The two workspace roots (CONTEXT §2). All repo paths derive from these.
const WORKSPACES = {
  'sp-local-workspace': 'C:\\Users\\TrungPhung\\Downloads\\repositories\\sp-local-workspace',
  'new-frontend': 'C:\\Users\\TrungPhung\\Downloads\\repositories\\new-frontend',
};

const SP = WORKSPACES['sp-local-workspace'];
const NF = WORKSPACES['new-frontend'];

const SP_BRANCH = 'master'; // CONTEXT §4 — every sp-local-workspace repo
const NF_BRANCH = 'new-frontend-dev-prod'; // CONTEXT §4 — new-frontend

// Field contract per repo:
//   id              : stable identifier used by IPC / config
//   name            : human label
//   role            : short description
//   workspace       : 'sp-local-workspace' | 'new-frontend'
//   path            : absolute repo path
//   packageManager  : 'npm' | 'pnpm'
//   installCwd      : absolute dir where install runs
//   runCwd          : absolute dir where build/start run
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
    portConflictWith: ['token-service'], // both default 4000 (CONTEXT §8)
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
    port: 4000,
    defaultBranch: SP_BRANCH,
    needsVpn: true,
    buildOnly: false,
    servedBy: null,
    portConflictWith: ['loyalty'], // both default 4000 (CONTEXT §8)
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
    // Built via selfpointrest orchestration script, which runs from selfpointrest.
    runCwd: path.join(SP, 'servers', 'selfpointrest'),
    install: 'npm install', // postinstall runs `npx bower install`
    build: 'npm run build-backend', // selfpointrest: node builder backend build -> build/backend
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
    // Built via selfpointrest orchestration scripts (per template).
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
    // Each template builds via selfpointrest and is served on its own route.
    templates: [
      {
        id: 'kikar',
        name: 'Kikar',
        build: 'npm run build-kikar', // selfpointrest: node builder frontend build -t kikar
        servedBy: { repo: 'selfpointrest', route: '/kikar' },
      },
      {
        id: 'prutah',
        name: 'Prutah',
        build: 'npm run build-prutah', // selfpointrest: node builder frontend build -t prutah
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

module.exports = repos;
module.exports.repos = repos;
module.exports.WORKSPACES = WORKSPACES;

// Lookup helper reused by later tasks (git/deps/runner) — avoids re-scanning the array.
module.exports.getRepo = function getRepo(id) {
  return repos.find((r) => r.id === id) || null;
};
