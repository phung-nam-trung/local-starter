import React, { useEffect, useState } from 'react';
import BranchPicker from './BranchPicker.jsx';
import DepsPanel from './DepsPanel.jsx';
import EnvSelector from './EnvSelector.jsx';

// F1 / TA2 — list the 9 repos grouped by workspace, each with a select checkbox.
// F2/F3 / TB2 — clicking a repo makes it "active"; the BranchPicker on the right shows
// that repo's branch/clean status and offers Fetch / Checkout / Pull.
// Selection state is kept here in the renderer (persisting it is TI1, not done yet).
export default function RepoList() {
  const [repos, setRepos] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [activeId, setActiveId] = useState(null); // repo whose branches show in the picker
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    window.launcher
      .listRepos()
      .then((list) => {
        if (active) setRepos(list);
      })
      .catch((err) => {
        if (active) setError(String(err));
      });
    return () => {
      active = false;
    };
  }, []);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (error) {
    return <p style={{ color: '#b00020' }}>Failed to load repos: {error}</p>;
  }

  // Preserve registry order while grouping by workspace.
  const groups = [];
  const indexByWorkspace = new Map();
  for (const repo of repos) {
    if (!indexByWorkspace.has(repo.workspace)) {
      indexByWorkspace.set(repo.workspace, groups.length);
      groups.push({ workspace: repo.workspace, items: [] });
    }
    groups[indexByWorkspace.get(repo.workspace)].items.push(repo);
  }

  const activeRepo = repos.find((r) => r.id === activeId) || null;

  return (
    <section style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <h2 style={{ marginBottom: '0.25rem' }}>Repos</h2>
        <p style={{ margin: '0 0 1rem', color: '#555' }}>
          {selected.size} selected / {repos.length} total · click một repo để xem branch
        </p>

        {groups.map((group) => (
          <div key={group.workspace} style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>
              {group.workspace}
            </h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {group.items.map((repo) => {
                const isActive = repo.id === activeId;
                return (
                  <li
                    key={repo.id}
                    style={{
                      border: isActive ? '1px solid #4060d0' : '1px solid #ddd',
                      background: isActive ? '#eef1fb' : 'transparent',
                      borderRadius: 6,
                      padding: '0.5rem 0.75rem',
                      marginBottom: '0.5rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.6rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(repo.id)}
                      onChange={() => toggle(repo.id)}
                      style={{ marginTop: '0.2rem' }}
                      aria-label={`Select ${repo.name}`}
                    />
                    {/* Clicking the body (not the checkbox) makes this the active repo. */}
                    <button
                      type="button"
                      onClick={() => setActiveId(repo.id)}
                      style={{
                        all: 'unset',
                        cursor: 'pointer',
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <strong>{repo.name}</strong>
                      <span style={{ color: '#666' }}>
                        {' '}
                        · branch {repo.defaultBranch} · port{' '}
                        {repo.port == null ? 'n/a (build-only)' : repo.port}
                      </span>
                      <br />
                      <code style={{ fontSize: '0.8rem', color: '#444' }}>
                        {repo.path}
                      </code>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div
        style={{
          flex: '1 1 0',
          minWidth: 0,
          position: 'sticky',
          top: '1rem',
          display: 'grid',
          gap: '1rem',
        }}
      >
        <EnvSelector />
        <BranchPicker repo={activeRepo} />
        <DepsPanel repo={activeRepo} />
      </div>
    </section>
  );
}
