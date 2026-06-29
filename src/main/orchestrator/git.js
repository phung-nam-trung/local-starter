'use strict';

// Git layer — UI-agnostic helpers over the `git` CLI.
// TB1: list branches (local + remote), current branch, working-tree cleanliness.
// TB2: fetch (--all --prune), safe checkout, safe pull. All mutating ops here REFUSE to
// touch a dirty working tree — they return { ok:false, reason:'dirty' } instead of
// throwing or running git, so the caller (and the UI) can warn without losing changes.
//
// Every repo path comes from the registry (repos.js getRepo); we never hardcode paths.
// We use execFile('git', [args...]) — args as an ARRAY, never a concatenated string —
// so paths with spaces and odd branch names never hit shell quoting issues on Windows.

const { execFile } = require('node:child_process');
const { getRepo } = require('./repos');

// Resolve a repoId to its absolute working dir, or throw a clear error.
function repoCwd(repoId) {
  const repo = getRepo(repoId);
  if (!repo) {
    throw new Error(`Unknown repoId: ${repoId}`);
  }
  // Guard against a registry entry without a path — otherwise execFile would
  // silently run git in the launcher's own cwd instead of the target repo.
  if (!repo.path) {
    throw new Error(`Repo ${repoId} has no path in the registry.`);
  }
  return repo.path;
}

// Run `git <args>` in `cwd`, resolve trimmed stdout. Rejects with a readable message
// (git missing from PATH, not a git repo, etc.) — never leaks half-baked output.
function git(cwd, args) {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          if (err.code === 'ENOENT') {
            reject(new Error('git not found in PATH. Cài Git và mở lại app.'));
            return;
          }
          const detail = (stderr || err.message || '').toString().trim();
          reject(new Error(`git ${args.join(' ')} failed (cwd=${cwd}): ${detail}`));
          return;
        }
        resolve(stdout.toString());
      }
    );
  });
}

// listBranches(repoId) -> [{ name, isRemote, isCurrent }]
//   remote entries also carry { remote, short } (e.g. name "origin/feat-x" ->
//   remote "origin", short "feat-x") so TB2 needn't re-split "origin/".
// Local heads first (in git's order), then all remote branches. The symbolic
// `refs/remotes/<remote>/HEAD` pointer is dropped, but real remote refs are kept even
// when their bare branch name also exists locally (e.g. `master` + `origin/master`).
async function listBranches(repoId) {
  const cwd = repoCwd(repoId);
  // We match/filter on the FULL %(refname); %(refname:short) is only the display name.
  // (%(refname:short) collapses refs/remotes/origin/HEAD to bare "origin" — no slash —
  // so filtering on the short name would let that symbolic pointer through as a branch.)
  // %(HEAD) is '*' for the checked-out branch, ' ' otherwise. Stable, machine-readable
  // output — avoids parsing the decorated `git branch -a` text (prefixes, '->' lines).
  const out = await git(cwd, [
    'for-each-ref',
    '--format=%(refname)\t%(refname:short)\t%(HEAD)',
    'refs/heads',
    'refs/remotes',
  ]);

  const locals = [];
  const remotes = [];
  for (const line of out.split('\n')) {
    if (!line) continue;
    const [refname, short, head] = line.split('\t');
    if (!refname || !short) continue;

    if (refname.startsWith('refs/heads/')) {
      locals.push({ name: short, isRemote: false, isCurrent: head === '*' });
    } else if (refname.startsWith('refs/remotes/')) {
      // Drop the symbolic per-remote HEAD pointer (refs/remotes/<remote>/HEAD).
      // Filter on the full refname, not the short name (see comment above).
      if (/^refs\/remotes\/[^/]+\/HEAD$/.test(refname)) continue;
      // Split "origin/feat-x" into remote + bare branch name on the FIRST slash.
      const slash = short.indexOf('/');
      const remote = slash === -1 ? '' : short.slice(0, slash);
      const bare = slash === -1 ? short : short.slice(slash + 1);
      remotes.push({ name: short, isRemote: true, isCurrent: false, remote, short: bare });
    }
  }

  return [...locals, ...remotes];
}

// currentBranch(repoId) -> branch name, or '(detached)' when HEAD is detached.
async function currentBranch(repoId) {
  const cwd = repoCwd(repoId);
  const name = (await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  // Detached HEAD reports literally as "HEAD".
  return name === 'HEAD' ? '(detached)' : name;
}

// isClean(repoId) -> true when `git status --porcelain` is empty (no changes).
async function isClean(repoId) {
  const cwd = repoCwd(repoId);
  const out = await git(cwd, ['status', '--porcelain']);
  return out.trim() === '';
}

// ---------------------------------------------------------------------------
// TB2 — mutating ops. Each returns a SERIALIZABLE plain object so it crosses IPC
// cleanly and the UI never has to inspect an Error instance:
//   { ok: true,  branch?, message? }
//   { ok: false, reason: 'dirty' | 'error' | 'unknown-repo', branch?, message }
// `branch` (when present) is the repo's current branch AFTER the call — handy for the
// UI to confirm a checkout actually moved (or, on refusal, that it did NOT).
// ---------------------------------------------------------------------------

// Build a uniform error result, surfacing git's stderr in `message` (already baked into
// the Error thrown by git()). Never throws — callers get a result object either way.
function errResult(err) {
  return { ok: false, reason: 'error', message: (err && err.message) || String(err) };
}

// fetch(repoId) -> { ok, message } | { ok:false, reason:'error', message }
// `git fetch --all --prune`. Read-only w.r.t. the working tree (updates remote-tracking
// refs only), so it is always safe to run — no clean check needed.
async function fetch(repoId) {
  let cwd;
  try {
    cwd = repoCwd(repoId);
  } catch (err) {
    return { ok: false, reason: 'unknown-repo', message: err.message };
  }
  try {
    // git writes its progress ("Fetching origin", pruned refs) to stderr; we don't need
    // it on success, and git() already folds stderr into the error message on failure.
    await git(cwd, ['fetch', '--all', '--prune']);
    return { ok: true, message: 'Fetched all remotes (pruned stale refs).' };
  } catch (err) {
    return errResult(err);
  }
}

// checkout(repoId, branch) -> result object.
// SAFE by contract: refuses when the working tree is dirty (returns reason:'dirty' and
// does NOT run checkout) so local changes are never clobbered. `branch` may be:
//   - a local branch name (e.g. "master")           -> `git checkout master`
//   - a remote-only ref ("origin/feat-x" or its bare "feat-x" when only remote exists)
//        -> create a tracking branch: `git checkout -b feat-x --track origin/feat-x`
// We resolve which case applies from listBranches() rather than guessing from the string.
async function checkout(repoId, branch) {
  let cwd;
  try {
    cwd = repoCwd(repoId);
  } catch (err) {
    return { ok: false, reason: 'unknown-repo', message: err.message };
  }
  if (!branch || typeof branch !== 'string') {
    return { ok: false, reason: 'error', message: 'checkout: branch is required.' };
  }

  try {
    // Guard FIRST: never mutate a dirty tree. Report the current branch so the UI can
    // show "still on <X>" — proof nothing moved.
    if (!(await isClean(repoId))) {
      const cur = await currentBranch(repoId);
      return {
        ok: false,
        reason: 'dirty',
        branch: cur,
        message:
          'Working tree có thay đổi chưa commit — checkout bị từ chối để không mất thay đổi. ' +
          'Hãy commit/stash thủ công rồi thử lại.',
      };
    }

    // Decide local vs remote-only from the branch list (single source of truth).
    const branches = await listBranches(repoId);
    const local = branches.find((b) => !b.isRemote && b.name === branch);
    // Match a remote entry either by its full name ("origin/feat-x") or bare short ("feat-x").
    const remote = branches.find(
      (b) => b.isRemote && (b.name === branch || b.short === branch)
    );

    if (local) {
      // Plain local branch — just switch to it.
      await git(cwd, ['checkout', branch]);
    } else if (remote) {
      const localForRemote = branches.find((b) => !b.isRemote && b.name === remote.short);
      if (localForRemote) {
        // The picker can show both `master` and `origin/master`. If the user selects the
        // remote ref while the local branch already exists, switch to the local branch
        // instead of trying to create a duplicate local name.
        await git(cwd, ['checkout', localForRemote.name]);
      } else {
        // Remote-only: create a local tracking branch named after the bare branch.
        // `--track origin/<short>` sets upstream so a later pull "just works".
        const short = remote.short || branch;
        const upstream = remote.name; // e.g. "origin/feat-x"
        await git(cwd, ['checkout', '-b', short, '--track', upstream]);
      }
    } else {
      // Neither local nor a known remote ref — surface a clear, non-throwing error.
      return {
        ok: false,
        reason: 'error',
        message: `Branch "${branch}" không có trong local lẫn remote (thử Fetch trước?).`,
      };
    }

    const cur = await currentBranch(repoId);
    return { ok: true, branch: cur, message: `Đã checkout "${cur}".` };
  } catch (err) {
    return errResult(err);
  }
}

// pull(repoId) -> result object. Safe: refuses on a dirty tree (reason:'dirty'); never
// force-pulls. On a clean tree runs `git pull` (uses the current branch's upstream).
async function pull(repoId) {
  let cwd;
  try {
    cwd = repoCwd(repoId);
  } catch (err) {
    return { ok: false, reason: 'unknown-repo', message: err.message };
  }
  try {
    if (!(await isClean(repoId))) {
      const cur = await currentBranch(repoId);
      return {
        ok: false,
        reason: 'dirty',
        branch: cur,
        message:
          'Working tree có thay đổi chưa commit — pull bị từ chối để không mất thay đổi. ' +
          'Hãy commit/stash thủ công rồi thử lại.',
      };
    }
    const out = await git(cwd, ['pull']);
    const cur = await currentBranch(repoId);
    return { ok: true, branch: cur, message: out.trim() || 'Already up to date.' };
  } catch (err) {
    return errResult(err);
  }
}

module.exports = { listBranches, currentBranch, isClean, fetch, checkout, pull };
