import React, { useCallback, useEffect, useRef, useState } from 'react';

// F11 / TH1 — dashboard over ALL repos: state · port · current branch · current step,
// plus a quick Stop for any repo that's running. Mounted at the top of the page so the
// whole environment is visible at a glance, independent of which repo is "active".
//
// Two data sources with very different costs:
//   - STATE/PORT/STEP: runner.statusAll() reads in-memory snapshots (no spawn), so we POLL
//     it every ~1.5s → a process that crashes/stops shows up without a manual refresh.
//   - BRANCH: git.currentBranch spawns a `git` process per repo. Polling that every 1.5s
//     would mean 9 git processes/poll, so we fetch branches ONCE on mount + on demand
//     ("Refresh branches") and cache the result.
const STATE_COLORS = {
  running: '#107c10',
  building: '#7a4d00',
  starting: '#7a4d00',
  crashed: '#b00020',
  stopped: '#555',
};

const POLL_INTERVAL_MS = 1500;

export default function StatusTable() {
  const [repos, setRepos] = useState([]);
  const [statusById, setStatusById] = useState({}); // repoId -> snapshot
  const [branchById, setBranchById] = useState({}); // repoId -> branch name | null
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stopping, setStopping] = useState(null); // repoId currently being stopped
  const [stoppingAll, setStoppingAll] = useState(false); // Stop all in flight
  const [stopAllMsg, setStopAllMsg] = useState(null); // short result of the last Stop all
  // Latest repo list for callbacks (avoids re-creating refreshBranches on every repos change).
  const reposRef = useRef([]);

  // Fetch every repo's current branch (read-only git) once, in parallel, and cache it.
  // Per-repo failures resolve to null so one bad repo never blanks the whole column.
  const refreshBranches = useCallback(async (list) => {
    const target = list || reposRef.current;
    if (!target.length) return;
    setBranchesLoading(true);
    try {
      const entries = await Promise.all(
        target.map(async (repo) => {
          try {
            const branch = await window.launcher.git.currentBranch(repo.id);
            return [repo.id, branch];
          } catch (_err) {
            return [repo.id, null];
          }
        })
      );
      setBranchById(Object.fromEntries(entries));
    } finally {
      setBranchesLoading(false);
    }
  }, []);

  // Load the registry once, then prime the branch cache for it.
  useEffect(() => {
    let active = true;
    window.launcher
      .listRepos()
      .then((list) => {
        if (!active) return;
        setRepos(list);
        reposRef.current = list;
        refreshBranches(list);
      })
      .catch((err) => {
        if (active) setError(String(err));
      });
    return () => {
      active = false;
    };
  }, [refreshBranches]);

  // Poll the in-memory status of every repo. Cheap (no spawn) → safe at 1.5s.
  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const all = await window.launcher.runner.statusAll();
        if (!active) return;
        const byId = {};
        for (const s of all) byId[s.repoId] = s;
        setStatusById(byId);
      } catch (err) {
        if (active) setError(String(err));
      }
    };
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  async function onStop(repoId) {
    setStopping(repoId);
    try {
      const res = await window.launcher.runner.stop(repoId);
      if (res && res.status) {
        setStatusById((prev) => ({ ...prev, [repoId]: res.status }));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setStopping(null);
    }
  }

  // F9 / TH2 — Stop all active repos (tree-kill, frees ports). After it returns, refresh the
  // status snapshot immediately so the table reflects the stopped state without waiting for
  // the next poll, and show a short summary.
  async function onStopAll() {
    setStoppingAll(true);
    setStopAllMsg(null);
    try {
      const res = await window.launcher.runner.stopAll();
      const stopped = (res && res.stopped) || [];
      setStopAllMsg(
        stopped.length === 0
          ? 'Khong co repo nao dang chay.'
          : `Da stop ${stopped.length} repo.`
      );
      try {
        const all = await window.launcher.runner.statusAll();
        const byId = {};
        for (const s of all) byId[s.repoId] = s;
        setStatusById(byId);
      } catch (_err) {
        // The 1.5s poll will catch up if this one-off refresh fails.
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setStoppingAll(false);
    }
  }

  if (error) {
    return (
      <section style={styles.panel}>
        <p style={{ color: '#b00020', margin: 0 }}>Status table error: {error}</p>
      </section>
    );
  }

  const runningCount = repos.reduce((n, repo) => {
    const s = statusById[repo.id];
    return n + (s && (s.state === 'running' || s.state === 'building' || s.state === 'starting') ? 1 : 0);
  }, 0);

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <h2 style={{ margin: 0 }}>Status</h2>
        <span style={styles.summary}>
          {runningCount} running / {repos.length} repos
        </span>
        {stopAllMsg ? <span style={styles.summary}>{stopAllMsg}</span> : null}
        <button
          type="button"
          onClick={onStopAll}
          disabled={stoppingAll || runningCount === 0}
          style={styles.stopAllBtn}
        >
          {stoppingAll ? 'Stopping all...' : 'Stop all'}
        </button>
        <button
          type="button"
          onClick={() => refreshBranches()}
          disabled={branchesLoading}
        >
          {branchesLoading ? 'Refreshing...' : 'Refresh branches'}
        </button>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Repo</th>
            <th style={styles.th}>State</th>
            <th style={styles.th}>Port</th>
            <th style={styles.th}>Branch</th>
            <th style={styles.th}>Step</th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {repos.map((repo) => {
            const s = statusById[repo.id];
            const state = s ? s.state : 'stopped';
            const port = s && s.port != null ? s.port : repo.port;
            const branch = branchById[repo.id];
            const running = state === 'running' || state === 'building' || state === 'starting';
            return (
              <tr key={repo.id} style={styles.tr}>
                <td style={styles.td}>
                  <code>{repo.name}</code>
                </td>
                <td style={styles.td}>
                  <span style={{ ...styles.badge, background: STATE_COLORS[state] || '#555' }}>
                    {state}
                  </span>
                </td>
                <td style={styles.td}>{port == null ? <span style={styles.muted}>n/a</span> : port}</td>
                <td style={styles.td}>
                  {branch ? <code style={styles.branch}>{branch}</code> : <span style={styles.muted}>-</span>}
                </td>
                <td style={styles.td}>
                  {s && s.step ? <span style={styles.muted}>{s.step}</span> : <span style={styles.muted}>-</span>}
                </td>
                <td style={styles.tdActions}>
                  {running ? (
                    <button
                      type="button"
                      onClick={() => onStop(repo.id)}
                      disabled={stopping === repo.id}
                    >
                      {stopping === repo.id ? 'Stopping...' : 'Stop'}
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

const styles = {
  panel: {
    border: '1px solid #ddd',
    borderRadius: 6,
    padding: '0.75rem 1rem',
    marginBottom: '1.5rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.6rem',
  },
  summary: {
    color: '#555',
    fontSize: '0.9rem',
  },
  stopAllBtn: {
    marginLeft: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.9rem',
  },
  th: {
    textAlign: 'left',
    borderBottom: '2px solid #e3e3e3',
    padding: '0.35rem 0.5rem',
    color: '#555',
    fontWeight: 600,
  },
  tr: {
    borderBottom: '1px solid #eee',
  },
  td: {
    padding: '0.35rem 0.5rem',
    verticalAlign: 'middle',
  },
  tdActions: {
    padding: '0.35rem 0.5rem',
    textAlign: 'right',
    verticalAlign: 'middle',
  },
  badge: {
    display: 'inline-block',
    color: '#fff',
    borderRadius: 10,
    padding: '0.1rem 0.55rem',
    fontSize: '0.78rem',
    textTransform: 'lowercase',
  },
  branch: {
    fontSize: '0.82rem',
    color: '#333',
  },
  muted: {
    color: '#999',
    fontSize: '0.82rem',
  },
};
