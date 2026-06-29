import React, { useEffect, useState } from 'react';

// F1 / TA2 — list the 9 repos grouped by workspace, each with a select checkbox.
// Selection state is kept here in the renderer (persisting it is TI1, not done yet).
export default function RepoList() {
  const [repos, setRepos] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
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

  return (
    <section>
      <h2 style={{ marginBottom: '0.25rem' }}>Repos</h2>
      <p style={{ margin: '0 0 1rem', color: '#555' }}>
        {selected.size} selected / {repos.length} total
      </p>

      {groups.map((group) => (
        <div key={group.workspace} style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>
            {group.workspace}
          </h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {group.items.map((repo) => (
              <li
                key={repo.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  padding: '0.5rem 0.75rem',
                  marginBottom: '0.5rem',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(repo.id)}
                    onChange={() => toggle(repo.id)}
                    style={{ marginTop: '0.2rem' }}
                  />
                  <span>
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
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
