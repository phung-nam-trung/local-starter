'use strict';

// Git layer (TB1) — UI-agnostic read-only helpers over the `git` CLI.
// Scope: list branches (local + remote), current branch, working-tree cleanliness.
// Fetch / checkout / pull and the branch picker UI are TB2 — NOT here.
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
// Local heads first (in git's order), then remote-only branches. A remote ref whose
// bare name already exists locally is deduped away (local entry wins, it carries
// isCurrent). The symbolic `refs/remotes/<remote>/HEAD` pointer is dropped.
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

  // Dedupe: a remote branch whose bare name matches a local branch is redundant.
  const localNames = new Set(locals.map((b) => b.name));
  const dedupedRemotes = remotes.filter((b) => !localNames.has(b.short));

  return [...locals, ...dedupedRemotes];
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

module.exports = { listBranches, currentBranch, isClean };
