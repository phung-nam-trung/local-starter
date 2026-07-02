import React, { useCallback, useEffect, useState } from 'react';

// F2/F3 / TB2 / TN2 — branch picker for ONE repo.
// Shows current branch + clean/dirty; Fetch; a branch dropdown (local + remote) with the
// repo's CURRENT branch PRESELECTED when present (fallback: repo.defaultBranch, else first
// in list — never fails just because the current/default is missing); Checkout + Pull.
//
// SAFETY: when the working tree is dirty we DISABLE checkout/pull and show a warning.
// The main process also refuses dirty mutations (reason:'dirty') — this UI guard is the
// first line; the orchestrator is the backstop. We never stash/overwrite for the user.

// Pick the branch to preselect from the loaded list (TN2: current-first so the dropdown
// reflects the branch the repo is actually on, not the static defaultBranch):
//   1) the CURRENT branch if a LOCAL branch by that name exists
//   2) else repo.defaultBranch as a LOCAL branch by that name
//   3) else a remote whose bare short == defaultBranch (e.g. only origin/master exists)
//   4) else the first entry
// Returns the branch *value* we use for <select> (full name, e.g. "master" or "origin/x").
function pickDefault(branches, defaultBranch, current) {
  if (!branches.length) return '';
  if (current) {
    const curMatch = branches.find((b) => !b.isRemote && b.name === current);
    if (curMatch) return curMatch.name;
  }
  if (defaultBranch) {
    const localMatch = branches.find((b) => !b.isRemote && b.name === defaultBranch);
    if (localMatch) return localMatch.name;
    const remoteMatch = branches.find((b) => b.isRemote && b.short === defaultBranch);
    if (remoteMatch) return remoteMatch.name;
  }
  return branches[0].name;
}

function clipPreview(text) {
  const value = text && text.trim() ? text.trim() : '(empty)';
  const limit = 3000;
  return value.length > limit ? `${value.slice(0, limit)}\n... (truncated)` : value;
}

function buildDestructiveConfirm(repo, actionName, preview, includeClean, monorepoRoot) {
  const lines = [
    `Repo: ${repo.name} (${repo.id})`,
    `Action: ${actionName}`,
    '',
    'Preview: git status --short',
    clipPreview(preview.statusShort),
  ];

  if (includeClean) {
    lines.push('', 'Preview: git clean -fdn', clipPreview(preview.cleanPreview));
  }

  if (monorepoRoot) {
    lines.push(
      '',
      'WARNING: stor-web uses the new-frontend monorepo root. This action affects the whole new-frontend worktree, not only apps/stor-web.'
    );
  }

  lines.push('', 'Continue?');
  return lines.join('\n');
}

export default function BranchPicker({ repo, onBranchChanged }) {
  const [branches, setBranches] = useState([]);
  const [current, setCurrent] = useState(null);
  const [clean, setClean] = useState(null); // null = unknown/loading
  const [chosen, setChosen] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null); // 'fetch' | 'checkout' | 'pull' | null
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null); // last op result message (ok or refusal)

  // Reload current branch / cleanliness / branch list for this repo. Preselects default.
  const refresh = useCallback(
    async (preserveChosen) => {
      if (!repo) return;
      setLoading(true);
      setError(null);
      try {
        const [list, cur, isClean] = await Promise.all([
          window.launcher.git.listBranches(repo.id),
          window.launcher.git.currentBranch(repo.id),
          window.launcher.git.isClean(repo.id),
        ]);
        setBranches(list);
        setCurrent(cur);
        setClean(isClean);
        setChosen((prev) =>
          preserveChosen && prev && list.some((b) => b.name === prev)
            ? prev
            : pickDefault(list, repo.defaultBranch, cur)
        );
      } catch (err) {
        setError(String(err));
        setBranches([]);
        setCurrent(null);
        setClean(null);
      } finally {
        setLoading(false);
      }
    },
    [repo]
  );

  // Reload whenever the active repo changes. Reset transient notices too.
  useEffect(() => {
    setNotice(null);
    setError(null);
    refresh(false);
  }, [refresh]);

  if (!repo) {
    return (
      <section style={styles.panel}>
        <p style={{ margin: 0, color: '#666' }}>
          Chọn một repo ở danh sách bên trái để xem branch.
        </p>
      </section>
    );
  }

  const dirty = clean === false;
  // stor-web's .git lives at the new-frontend monorepo root, so a checkout/pull there
  // moves the WHOLE monorepo, not just apps/stor-web (CONTEXT §3.3 / TB2 note).
  const monorepoRoot = repo.id === 'stor-web';

  async function onFetch() {
    setBusy('fetch');
    setNotice(null);
    setError(null);
    try {
      const res = await window.launcher.git.fetch(repo.id);
      setNotice(res.message || (res.ok ? 'Fetched.' : 'Fetch failed.'));
      // Fetch can reveal new remote branches; reload the list (keep current selection).
      await refresh(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  async function onCheckout() {
    if (dirty) return; // UI guard; orchestrator also refuses.
    setBusy('checkout');
    setNotice(null);
    setError(null);
    try {
      const res = await window.launcher.git.checkout(repo.id, chosen);
      setNotice(res.message || (res.ok ? 'Checked out.' : 'Checkout refused.'));
      await refresh(true);
      onBranchChanged?.(); // let RepoList refresh the left-column branch labels
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  async function onPull() {
    if (dirty) return; // UI guard; orchestrator also refuses.
    setBusy('pull');
    setNotice(null);
    setError(null);
    try {
      const res = await window.launcher.git.pull(repo.id);
      setNotice(res.message || (res.ok ? 'Pulled.' : 'Pull refused.'));
      await refresh(true);
      onBranchChanged?.(); // pull can fast-forward/update the current branch
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  async function onResetTracked() {
    setBusy('preview-reset');
    setNotice(null);
    setError(null);
    try {
      const preview = await window.launcher.git.previewLocalChanges(repo.id, { includeClean: false });
      if (!preview.ok) {
        setNotice(preview.message || 'Preview failed.');
        return;
      }

      const confirmed = window.confirm(
        buildDestructiveConfirm(
          repo,
          'Reset tracked changes to current HEAD (git reset --hard HEAD). Untracked files are left untouched.',
          preview,
          false,
          monorepoRoot
        )
      );
      if (!confirmed) {
        setNotice('Reset tracked changes cancelled.');
        return;
      }

      setBusy('reset-tracked');
      const res = await window.launcher.git.resetTrackedChanges(repo.id, {
        confirmed: true,
        repoId: repo.id,
        action: 'reset-tracked',
      });
      const after = res.statusAfter && res.statusAfter.trim() ? `\n\nStatus after:\n${res.statusAfter}` : '';
      setNotice((res.message || (res.ok ? 'Tracked changes reset.' : 'Reset refused.')) + after);
      await refresh(true);
      onBranchChanged?.(); // working tree changed; keep RepoList branch labels in sync
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  async function onDiscardAll() {
    setBusy('preview-discard');
    setNotice(null);
    setError(null);
    try {
      const preview = await window.launcher.git.previewLocalChanges(repo.id, { includeClean: true });
      if (!preview.ok) {
        setNotice(preview.message || 'Preview failed.');
        return;
      }

      const confirmed = window.confirm(
        buildDestructiveConfirm(
          repo,
          'Discard ALL local changes (git reset --hard HEAD + git clean -fd). Removes untracked non-ignored files.',
          preview,
          true,
          monorepoRoot
        )
      );
      if (!confirmed) {
        setNotice('Discard all local changes cancelled.');
        return;
      }

      setBusy('discard-all');
      const res = await window.launcher.git.discardAllLocalChanges(repo.id, {
        confirmed: true,
        repoId: repo.id,
        action: 'discard-all',
      });
      const after = res.statusAfter && res.statusAfter.trim() ? `\n\nStatus after:\n${res.statusAfter}` : '';
      setNotice((res.message || (res.ok ? 'Local changes discarded.' : 'Discard refused.')) + after);
      await refresh(true);
      onBranchChanged?.(); // working tree changed; keep RepoList branch labels in sync
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  const anyBusy = busy !== null || loading;

  return (
    <section style={styles.panel}>
      <h3 style={{ margin: '0 0 0.5rem' }}>
        Branch · <code>{repo.name}</code>
      </h3>

      {error && <p style={styles.error}>Lỗi: {error}</p>}

      <p style={{ margin: '0 0 0.5rem' }}>
        Current:{' '}
        <strong>{current == null ? '…' : current}</strong>
        {' · '}
        {clean == null ? (
          'status …'
        ) : clean ? (
          <span style={{ color: '#107c10' }}>clean</span>
        ) : (
          <span style={{ color: '#b00020' }}>dirty (uncommitted changes)</span>
        )}
      </p>

      {dirty && (
        <div style={styles.warn}>
          Repo đang có thay đổi chưa commit. <strong>Checkout/Pull bị chặn</strong> để
          không mất thay đổi. Dùng các nút bên dưới chỉ khi bạn muốn bỏ thay đổi local sau
          khi xem preview.
        </div>
      )}

      {monorepoRoot && (
        <div style={styles.note}>
          Lưu ý: <code>stor-web</code> dùng <code>.git</code> ở <strong>root new-frontend</strong>{' '}
          (monorepo) — checkout/pull tác động <strong>cả monorepo</strong>, không chỉ apps/stor-web.
        </div>
      )}

      {dirty && (
        <div style={styles.destructive}>
          <p style={{ margin: '0 0 0.5rem' }}>
            Hành động destructive cần preview + confirm riêng cho repo này:
          </p>
          <div style={styles.row}>
            <button type="button" onClick={onResetTracked} disabled={anyBusy} style={styles.dangerButton}>
              {busy === 'preview-reset' || busy === 'reset-tracked'
                ? 'Resetting…'
                : 'Reset tracked changes'}
            </button>
            <button
              type="button"
              onClick={onDiscardAll}
              disabled={anyBusy}
              style={styles.dangerButton}
            >
              {busy === 'preview-discard' || busy === 'discard-all'
                ? 'Discarding…'
                : 'Discard all local changes'}
            </button>
          </div>
        </div>
      )}

      <div style={styles.row}>
        <button type="button" onClick={onFetch} disabled={anyBusy}>
          {busy === 'fetch' ? 'Fetching…' : 'Fetch (--all --prune)'}
        </button>
      </div>

      <div style={styles.row}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          Branch:
          <select
            value={chosen}
            onChange={(e) => setChosen(e.target.value)}
            disabled={anyBusy || branches.length === 0}
            style={{ flex: 1, minWidth: 0 }}
          >
            {branches.length === 0 && <option value="">(không có branch)</option>}
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.isRemote ? `${b.name} (remote)` : b.name}
                {b.isCurrent ? ' — current' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={styles.row}>
        <button
          type="button"
          onClick={onCheckout}
          disabled={anyBusy || dirty || !chosen || chosen === current}
          title={dirty ? 'Bị chặn: working tree dirty' : undefined}
        >
          {busy === 'checkout' ? 'Checking out…' : 'Checkout'}
        </button>
        <button
          type="button"
          onClick={onPull}
          disabled={anyBusy || dirty}
          title={dirty ? 'Bị chặn: working tree dirty' : undefined}
        >
          {busy === 'pull' ? 'Pulling…' : 'Pull'}
        </button>
      </div>

      {notice && <pre style={styles.notice}>{notice}</pre>}
    </section>
  );
}

const styles = {
  panel: {
    border: '1px solid #ddd',
    borderRadius: 6,
    padding: '0.75rem 1rem',
  },
  row: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    marginBottom: '0.6rem',
  },
  error: {
    color: '#b00020',
    background: '#fde7e9',
    padding: '0.4rem 0.6rem',
    borderRadius: 4,
    margin: '0 0 0.5rem',
  },
  warn: {
    color: '#7a4d00',
    background: '#fff4ce',
    border: '1px solid #f2d98c',
    padding: '0.5rem 0.6rem',
    borderRadius: 4,
    margin: '0 0 0.6rem',
    fontSize: '0.9rem',
  },
  note: {
    color: '#3a3a6a',
    background: '#eef1fb',
    border: '1px solid #c9d2f0',
    padding: '0.5rem 0.6rem',
    borderRadius: 4,
    margin: '0 0 0.6rem',
    fontSize: '0.85rem',
  },
  destructive: {
    color: '#5f1b1b',
    background: '#fff1f1',
    border: '1px solid #f0b5b5',
    padding: '0.5rem 0.6rem',
    borderRadius: 4,
    margin: '0 0 0.6rem',
    fontSize: '0.9rem',
  },
  dangerButton: {
    borderColor: '#b00020',
    color: '#b00020',
  },
  notice: {
    background: '#f3f3f3',
    border: '1px solid #e0e0e0',
    borderRadius: 4,
    padding: '0.5rem 0.6rem',
    margin: 0,
    whiteSpace: 'pre-wrap',
    fontSize: '0.85rem',
    maxHeight: 160,
    overflow: 'auto',
  },
};
