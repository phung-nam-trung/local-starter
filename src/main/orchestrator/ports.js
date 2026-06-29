'use strict';

// Ports layer (TF2) — UI-agnostic port checks for the pre-start guard.
//
// CONTEXT §8 (updated): selfpointrest 3000/3001, stor-web 3002, loyalty 4000,
// token-service 4001 (set via its own .env PORT — NO clash with loyalty), indexer 4002,
// mobile & collection both 9000 (only clash, rarely run together). Before starting a repo
// the launcher should check whether its effective port is already taken and, if so, say
// which repo (by default port) usually holds it.
//
// Why bind-probe instead of `netstat`: trying to bind 127.0.0.1:<port> is the same check
// the dev server itself does, so EADDRINUSE here means the server WOULD fail the same way.
// It needs no admin rights, no parsing, and works identically on every Windows box.
//
// Every export returns a SERIALIZABLE plain value / Promise and never throws across IPC.

const net = require('node:net');
const { getRepo, repos } = require('./repos');

// isPortBusy(port) -> Promise<boolean>
// true  => something is already listening on 127.0.0.1:<port> (EADDRINUSE).
// false => the port is free (we bound it momentarily and closed it immediately).
// A non-numeric/out-of-range port is treated as "not busy" (nothing to guard).
function isPortBusy(port) {
  return new Promise((resolve) => {
    const p = Number(port);
    if (!Number.isInteger(p) || p <= 0 || p > 65535) {
      resolve(false);
      return;
    }

    const server = net.createServer();

    // If we can't even create/bind for an unexpected reason, fail open (don't block start):
    // EADDRINUSE is the ONLY signal we treat as "busy".
    server.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        resolve(true);
        return;
      }
      resolve(false);
    });

    server.once('listening', () => {
      // Bound successfully => port is free. Close right away and report not busy.
      server.close(() => resolve(false));
    });

    // Bind to the loopback host the dev servers use. exclusive:true so we don't share the
    // port and get a false "free" reading.
    server.listen({ port: p, host: '127.0.0.1', exclusive: true });
  });
}

// repoForPort(port) -> repoId | null
// Which registry repo uses this port by default (so we can say "held by <repo>"). If two
// repos share a port (mobile/collection on 9000) we return the FIRST match — it's only a
// human hint in the message, not a decision input.
function repoForPort(port) {
  const p = Number(port);
  if (!Number.isInteger(p)) return null;
  const match = repos.find((r) => r.port === p);
  return match ? match.id : null;
}

// checkRepoPort(repoId, opts) -> Promise<{ repoId, port, busy, heldBy }>
// Resolves the repo's effective port (registry default, or opts.port override) and probes
// it. A repo with no port (build-only UI like backend/frontend) resolves { port:null,
// busy:false } — there is nothing to guard. `heldBy` is the registry repo that owns the
// port by default (may equal repoId, e.g. when restarting the same repo's own port).
async function checkRepoPort(repoId, opts = {}) {
  const repo = getRepo(repoId);
  if (!repo) {
    return { repoId, port: null, busy: false, heldBy: null, reason: 'unknown-repo' };
  }

  let port = repo.port;
  if (opts.port != null && Number.isFinite(Number(opts.port))) {
    port = Number(opts.port);
  }

  if (port == null) {
    return { repoId, port: null, busy: false, heldBy: null };
  }

  const busy = await isPortBusy(port);
  return { repoId, port, busy, heldBy: repoForPort(port) };
}

module.exports = {
  isPortBusy,
  repoForPort,
  checkRepoPort,
};
