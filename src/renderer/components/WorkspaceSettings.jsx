import React, { useCallback, useEffect, useState } from 'react';

// Phase K / TK3 — configure the two workspace roots (CONTEXT §2): sp-local-workspace and
// new-frontend. Each root shows its validation status (valid / invalid / missing) from
// store.validateRoot via window.launcher.workspace.*, with the required markers when invalid
// (sp ↔ servers/selfpointrest + public; nf ↔ apps/stor-web + nx.json|pnpm-lock.yaml).
//
// "Change…" opens the Electron folder picker; a text input allows typing a path by hand.
// Both go through workspace.setRoots, which validates + persists into the userData config (so
// the choice survives a restart) and re-applies the roots to the repo registry in main. On a
// successful save we call onRootsChanged so App can re-check gating and refresh the repo list.
//
// `compact` renders the panel as a normal settings card (roots already valid); without it the
// panel renders as the prominent first-run onboarding (with a heading + intro line).
const ROOTS = [
  {
    key: 'spLocalWorkspace',
    kind: 'sp',
    label: 'sp-local-workspace',
    markers: 'servers/selfpointrest, public',
  },
  {
    key: 'newFrontend',
    kind: 'nf',
    label: 'new-frontend',
    markers: 'apps/stor-web, nx.json | pnpm-lock.yaml',
  },
];

function statusLabel(validation, configured) {
  if (!validation) return { text: 'unknown', kind: 'muted' };
  if (validation.valid) return { text: 'valid', kind: 'ok' };
  if (validation.reason === 'missing' && !configured) return { text: 'missing', kind: 'warn' };
  return { text: 'invalid', kind: 'error' };
}

export default function WorkspaceSettings({ compact = false, onRootsChanged }) {
  const [status, setStatus] = useState(null); // workspace.getRoots() result
  const [drafts, setDrafts] = useState({ spLocalWorkspace: '', newFrontend: '' });
  const [busyKey, setBusyKey] = useState(null); // key of the root currently saving/picking
  const [error, setError] = useState(null);
  const [resultByKey, setResultByKey] = useState({}); // key -> { ok, message }

  const loadStatus = useCallback(async (active = true) => {
    try {
      const res = await window.launcher.workspace.getRoots();
      if (!active) return;
      setStatus(res);
      // Seed the text inputs with the currently resolved roots so editing starts from reality.
      setDrafts({
        spLocalWorkspace: (res.roots && res.roots.spLocalWorkspace) || '',
        newFrontend: (res.roots && res.roots.newFrontend) || '',
      });
    } catch (err) {
      if (active) setError(String(err));
    }
  }, []);

  useEffect(() => {
    let active = true;
    setError(null);
    loadStatus(active);
    return () => {
      active = false;
    };
  }, [loadStatus]);

  // Persist a single root via workspace.setRoots (validates + saves to config). On success we
  // refresh our own status and notify the parent so it can re-gate + reload the repo list.
  async function applyRoot(key, dir) {
    setBusyKey(key);
    setError(null);
    setResultByKey((prev) => ({ ...prev, [key]: null }));
    try {
      const res = await window.launcher.workspace.setRoots({ [key]: dir });
      if (res && res.saved) {
        setStatus(res);
        setDrafts({
          spLocalWorkspace: (res.roots && res.roots.spLocalWorkspace) || '',
          newFrontend: (res.roots && res.roots.newFrontend) || '',
        });
        setResultByKey((prev) => ({ ...prev, [key]: { ok: true, message: 'Saved.' } }));
        if (typeof onRootsChanged === 'function') onRootsChanged(res);
      } else {
        // Validation failed in main (reason:'invalid-root') or save failed — surface the reason
        // and keep the latest known status so the markers stay visible.
        const incoming = res && res.validation && res.validation[key];
        const message =
          (incoming && incoming.message) || (res && res.message) || 'Đường dẫn không hợp lệ.';
        if (res && res.current) setStatus(res.current);
        setResultByKey((prev) => ({ ...prev, [key]: { ok: false, message } }));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusyKey(null);
    }
  }

  // "Change…" → Electron folder picker → if a folder was chosen, save it (setRoots re-validates).
  async function pickRoot(root) {
    setBusyKey(root.key);
    setError(null);
    try {
      const picked = await window.launcher.workspace.pickFolder({ kind: root.kind });
      if (!picked || picked.canceled || !picked.path) {
        setBusyKey(null);
        return;
      }
      setDrafts((prev) => ({ ...prev, [root.key]: picked.path }));
      await applyRoot(root.key, picked.path);
    } catch (err) {
      setError(String(err));
      setBusyKey(null);
    }
  }

  const allValid = Boolean(status && status.allValid);

  return (
    <section style={compact ? styles.panel : styles.onboarding}>
      {compact ? (
        <h3 style={{ margin: '0 0 0.5rem' }}>Workspace roots</h3>
      ) : (
        <>
          <h2 style={{ margin: '0 0 0.25rem' }}>Cấu hình vị trí 2 workspace</h2>
          <p style={{ margin: '0 0 1rem', color: '#555' }}>
            Trỏ launcher tới 2 thư mục workspace gốc trước khi chạy. Mỗi root cần đủ marker
            (sp-local-workspace ↔ <code>servers/selfpointrest</code> + <code>public</code>;
            new-frontend ↔ <code>apps/stor-web</code> + <code>nx.json</code>/
            <code>pnpm-lock.yaml</code>).
          </p>
        </>
      )}

      {error && <p style={styles.error}>Error: {error}</p>}

      {ROOTS.map((root) => {
        const validation = status && status.validation ? status.validation[root.key] : null;
        const configured = status && status.configured ? status.configured[root.key] : false;
        const badge = statusLabel(validation, configured);
        const result = resultByKey[root.key];
        const busy = busyKey === root.key;

        return (
          <div key={root.key} style={styles.rootRow}>
            <div style={styles.rootHead}>
              <strong>{root.label}</strong>
              <span style={{ ...styles.badge, ...styles.badgeKind[badge.kind] }}>{badge.text}</span>
            </div>

            <div style={styles.controls}>
              <input
                type="text"
                value={drafts[root.key]}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [root.key]: e.target.value }))
                }
                placeholder={`Đường dẫn tới ${root.label}`}
                style={styles.input}
                spellCheck={false}
                aria-label={`Path for ${root.label}`}
              />
              <button
                type="button"
                onClick={() => pickRoot(root)}
                disabled={busy}
                style={styles.changeBtn}
              >
                {busy ? '...' : 'Change…'}
              </button>
              <button
                type="button"
                onClick={() => applyRoot(root.key, drafts[root.key])}
                disabled={busy}
              >
                Save
              </button>
            </div>

            {validation && !validation.valid && Array.isArray(validation.missing) &&
            validation.missing.length ? (
              <p style={styles.missing}>
                Thiếu marker: <code>{validation.missing.join(', ')}</code>
              </p>
            ) : null}
            {!validation || (validation && validation.valid) ? (
              <p style={styles.hint}>Marker yêu cầu: {root.markers}</p>
            ) : null}

            {result ? (
              <p style={result.ok ? styles.noticeOk : styles.error}>{result.message}</p>
            ) : null}
          </div>
        );
      })}

      {!compact && !allValid ? (
        <p style={styles.blockNote}>
          Hãy cấu hình vị trí 2 workspace hợp lệ trước khi chạy bất kỳ repo nào.
        </p>
      ) : null}
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
  onboarding: {
    border: '2px solid #4060d0',
    background: '#eef1fb',
    borderRadius: 8,
    padding: '1.25rem 1.5rem',
    marginBottom: '1.5rem',
  },
  rootRow: {
    borderTop: '1px solid #e3e3e3',
    paddingTop: '0.6rem',
    marginTop: '0.6rem',
  },
  rootHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    marginBottom: '0.4rem',
  },
  controls: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    alignItems: 'center',
  },
  input: {
    flex: '1 1 18rem',
    minWidth: 0,
    padding: '0.4rem 0.5rem',
    border: '1px solid #c8c8c8',
    borderRadius: 4,
    fontFamily: 'Consolas, monospace',
    fontSize: '0.85rem',
  },
  changeBtn: {},
  badge: {
    display: 'inline-block',
    color: '#fff',
    borderRadius: 10,
    padding: '0.1rem 0.55rem',
    fontSize: '0.78rem',
  },
  badgeKind: {
    ok: { background: '#107c10' },
    warn: { background: '#7a4d00' },
    error: { background: '#b00020' },
    muted: { background: '#999' },
  },
  missing: {
    margin: '0.4rem 0 0',
    color: '#b00020',
    fontSize: '0.85rem',
    overflowWrap: 'anywhere',
  },
  hint: {
    margin: '0.4rem 0 0',
    color: '#777',
    fontSize: '0.8rem',
  },
  blockNote: {
    marginTop: '1rem',
    color: '#7a4d00',
    background: '#fff4ce',
    border: '1px solid #f1d27a',
    padding: '0.5rem 0.7rem',
    borderRadius: 6,
    fontSize: '0.9rem',
  },
  error: {
    color: '#b00020',
    background: '#fde7e9',
    padding: '0.45rem 0.6rem',
    borderRadius: 4,
    margin: '0.4rem 0 0',
    overflowWrap: 'anywhere',
  },
  noticeOk: {
    color: '#107c10',
    background: '#edf7ed',
    padding: '0.45rem 0.6rem',
    borderRadius: 4,
    margin: '0.4rem 0 0',
  },
};
