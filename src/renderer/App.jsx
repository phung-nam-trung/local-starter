import React, { useCallback, useEffect, useState } from 'react';
import RepoList from './components/RepoList.jsx';
import StatusTable from './components/StatusTable.jsx';
import WorkspaceSettings from './components/WorkspaceSettings.jsx';

// Phase K / TK3 — first-run gating. On mount we load the two workspace roots + their validation
// (window.launcher.workspace.getRoots). Until BOTH roots are valid we show WorkspaceSettings as
// prominent onboarding and DO NOT render the run UI (StatusTable/RepoList), so no Start/Build/
// Install is reachable. Once both roots validate we render the full UI; WorkspaceSettings stays
// at the top as a compact settings card so the roots can be changed later.
//
// When the roots change (a successful setRoots), main has already re-applied them to the repo
// registry, so we (a) re-check gating and (b) bump reposVersion — passed as a `key` to
// StatusTable/RepoList — which remounts them and re-runs their listRepos() on mount, reflecting
// the new paths.
export default function App() {
  const [rootsStatus, setRootsStatus] = useState(null); // workspace.getRoots() result | null
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reposVersion, setReposVersion] = useState(0);

  const refreshGating = useCallback(async (active = true) => {
    try {
      const res = await window.launcher.workspace.getRoots();
      if (!active) return;
      setRootsStatus(res);
    } catch (err) {
      if (active) setError(String(err));
    } finally {
      if (active) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    refreshGating(active);
    return () => {
      active = false;
    };
  }, [refreshGating]);

  // Called by WorkspaceSettings after a successful root save. The save result IS a fresh status
  // (same shape as getRoots), so adopt it directly, then force the repo views to reload.
  const onRootsChanged = useCallback((nextStatus) => {
    if (nextStatus && typeof nextStatus.allValid === 'boolean') {
      setRootsStatus(nextStatus);
    } else {
      refreshGating(true);
    }
    setReposVersion((v) => v + 1);
  }, [refreshGating]);

  const allValid = Boolean(rootsStatus && rootsStatus.allValid);

  return (
    <main
      style={{
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        padding: '2rem',
      }}
    >
      <h1>Local Dev Launcher</h1>
      <p>SelfPoint local environment launcher.</p>

      {error && (
        <p style={{ color: '#b00020' }}>Failed to load workspace roots: {error}</p>
      )}

      {loading ? (
        <p style={{ color: '#555' }}>Đang kiểm tra cấu hình workspace...</p>
      ) : allValid ? (
        <>
          {/* Roots valid → settings stay available as a compact card, then the full run UI. */}
          <WorkspaceSettings compact onRootsChanged={onRootsChanged} />
          {/* TH1 — overview dashboard: state/port/branch/step for every repo + quick Stop. */}
          <StatusTable key={`status-${reposVersion}`} />
          <RepoList key={`repos-${reposVersion}`} />
        </>
      ) : (
        // First-run / invalid roots → onboarding only; the run UI is intentionally not mounted.
        <WorkspaceSettings onRootsChanged={onRootsChanged} />
      )}
    </main>
  );
}
