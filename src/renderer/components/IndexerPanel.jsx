import React, { useEffect, useState } from 'react';

// F8 / TG1 — indexer-only panel. Renders ONLY when the active repo is
// indexer-queue-subscriber (CONTEXT §7). Lets the dev:
//   - open test/products.js & test/specials.js in the default editor,
//   - patch products.js with a { retailerId, productIds } preset (idempotent + backup),
//   - patch the test:retailer / test:special config (config/default.json) (idempotent + backup),
//   - Restart the indexer (= runner.restart -> stop tree-kill + `npm start`, keeping
//     --max-old-space-size=3000).
// Each patch result shows changed? + the backup file name.
export default function IndexerPanel({ repo }) {
  const [retailerId, setRetailerId] = useState('1249');
  const [productIds, setProductIds] = useState('20097284, 4501409, 4512274, 15799543');
  const [special, setSpecial] = useState('');
  const [specialRetailer, setSpecialRetailer] = useState('');

  const [busy, setBusy] = useState(null); // 'open' | 'products' | 'specials' | 'restart' | 'restonly' | null
  const [openResult, setOpenResult] = useState(null);
  const [productsResult, setProductsResult] = useState(null);
  const [specialsResult, setSpecialsResult] = useState(null);
  const [restartResult, setRestartResult] = useState(null);
  const [error, setError] = useState(null);

  // TG2 — REST-only toggle (comment/uncomment queue.subscribe() in server.js). restOnly mirrors
  // the on-disk state; loaded on mount and after each set. restOnlyResult shows changed/backup.
  const [restOnly, setRestOnly] = useState(false);
  const [restOnlyResult, setRestOnlyResult] = useState(null);

  const isIndexer = repo && repo.id === 'indexer-queue-subscriber';

  // Load the current REST-only state when the panel mounts for the indexer.
  useEffect(() => {
    if (!isIndexer) return undefined;
    let cancelled = false;
    window.launcher.indexer
      .getRestOnly()
      .then((res) => {
        if (cancelled || !res) return;
        setRestOnlyResult(res);
        if (res.ok) setRestOnly(Boolean(res.restOnly));
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [isIndexer]);

  // Render nothing for non-indexer repos; RepoList always mounts this, so guard here.
  if (!isIndexer) return null;

  const anyBusy = busy !== null;

  async function run(kind, fn, setResult) {
    setBusy(kind);
    setError(null);
    setResult(null);
    try {
      const res = await fn();
      setResult(res);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  const onOpenFiles = () =>
    run('open', () => window.launcher.indexer.openFiles(), setOpenResult);

  const onApplyProducts = () =>
    run(
      'products',
      () => window.launcher.indexer.applyProducts({ retailerId, productIds }),
      setProductsResult
    );

  const onApplySpecials = () =>
    run(
      'specials',
      () =>
        window.launcher.indexer.applySpecials({
          retailer: specialRetailer,
          special,
        }),
      setSpecialsResult
    );

  // Restart reuses the generic runner.restart (no buildUIs for the indexer).
  const onRestart = () =>
    run('restart', () => window.launcher.runner.restart(repo.id, {}), setRestartResult);

  // TG2 — flip REST-only. Optimistically set the desired state, call setRestOnly, then sync the
  // checkbox to the authoritative on-disk state the handler reports back (revert on failure).
  const onToggleRestOnly = (e) => {
    const next = e.target.checked;
    setRestOnly(next);
    run('restonly', () => window.launcher.indexer.setRestOnly(next), (res) => {
      setRestOnlyResult(res);
      if (res && res.ok) setRestOnly(Boolean(res.restOnly));
      else setRestOnly(!next); // revert the checkbox if the patch failed
    });
  };

  return (
    <section style={styles.panel}>
      <h3 style={{ margin: '0 0 0.5rem' }}>
        Indexer - <code>{repo.name}</code>
      </h3>
      <p style={styles.meta}>
        Sua <code>test/products.js</code> &amp; <code>test/specials.js</code> (config:{' '}
        <code>config/default.json</code>) roi Restart. Moi patch idempotent + backup{' '}
        <code>*.bak-&lt;ts&gt;</code>.
      </p>

      {error && <p style={styles.error}>Loi: {error}</p>}

      <div style={styles.row}>
        <button type="button" onClick={onOpenFiles} disabled={anyBusy}>
          {busy === 'open' ? 'Opening...' : 'Open test files'}
        </button>
      </div>
      {openResult && <ResultLine result={openResult} />}

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>products.js preset</legend>
        <label style={styles.field}>
          retailerId
          <input
            type="text"
            inputMode="numeric"
            value={retailerId}
            onChange={(e) => setRetailerId(e.target.value)}
            disabled={anyBusy}
            style={styles.input}
          />
        </label>
        <label style={styles.field}>
          productIds (CSV)
          <input
            type="text"
            value={productIds}
            onChange={(e) => setProductIds(e.target.value)}
            disabled={anyBusy}
            placeholder="20097284, 4501409, ..."
            style={styles.input}
          />
        </label>
        <div style={styles.row}>
          <button type="button" onClick={onApplyProducts} disabled={anyBusy}>
            {busy === 'products' ? 'Applying...' : 'Apply products preset'}
          </button>
        </div>
        {productsResult && <ResultLine result={productsResult} />}
      </fieldset>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>specials config (test:retailer / test:special)</legend>
        <label style={styles.field}>
          retailer
          <input
            type="text"
            inputMode="numeric"
            value={specialRetailer}
            onChange={(e) => setSpecialRetailer(e.target.value)}
            disabled={anyBusy}
            placeholder="vd 10"
            style={styles.input}
          />
        </label>
        <label style={styles.field}>
          special
          <input
            type="text"
            inputMode="numeric"
            value={special}
            onChange={(e) => setSpecial(e.target.value)}
            disabled={anyBusy}
            placeholder="vd 113930"
            style={styles.input}
          />
        </label>
        <div style={styles.row}>
          <button type="button" onClick={onApplySpecials} disabled={anyBusy}>
            {busy === 'specials' ? 'Applying...' : 'Apply specials config'}
          </button>
        </div>
        {specialsResult && <ResultLine result={specialsResult} />}
      </fieldset>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>queue (server.js)</legend>
        <label style={styles.checkboxField}>
          <input
            type="checkbox"
            checked={restOnly}
            onChange={onToggleRestOnly}
            disabled={anyBusy}
          />
          REST-only (comment <code>queue.subscribe()</code>)
        </label>
        <p style={styles.meta}>
          Bat = comment <code>queue.subscribe()</code> de chi test REST, khong tieu thu queue.
          Doi xong phai <strong>Restart indexer</strong> ben duoi de ap dung.
        </p>
        {restOnlyResult && <ResultLine result={restOnlyResult} />}
      </fieldset>

      <div style={styles.row}>
        <button type="button" onClick={onRestart} disabled={anyBusy}>
          {busy === 'restart' ? 'Restarting...' : 'Restart indexer'}
        </button>
      </div>
      {restartResult && (
        <div style={restartResult.ok ? styles.notice : styles.error}>
          <strong>{restartResult.ok ? 'OK' : 'Failed'}:</strong> {restartResult.message}
        </div>
      )}
    </section>
  );
}

// Shared result renderer for the patch/open actions: shows ok/failed, the message, and the
// backup file name + changed flag when a patch ran.
function ResultLine({ result }) {
  return (
    <div style={result.ok ? styles.notice : styles.error}>
      <strong>{result.ok ? 'OK' : 'Failed'}:</strong> {result.message}
      {result.ok && Object.prototype.hasOwnProperty.call(result, 'changed') ? (
        <>
          {' '}
          <span style={styles.metaInline}>(changed: {String(result.changed)})</span>
        </>
      ) : null}
      {result.ok && result.backupName ? (
        <>
          <br />
          Backup: <code>{result.backupName}</code>
        </>
      ) : null}
    </div>
  );
}

const styles = {
  panel: {
    border: '1px solid #ddd',
    borderRadius: 6,
    padding: '0.75rem 1rem',
  },
  meta: {
    color: '#555',
    fontSize: '0.85rem',
    margin: '0 0 0.6rem',
    overflowWrap: 'anywhere',
  },
  metaInline: {
    color: '#555',
    fontSize: '0.8rem',
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    alignItems: 'center',
    marginBottom: '0.6rem',
  },
  fieldset: {
    border: '1px solid #ddd',
    borderRadius: 4,
    margin: '0 0 0.6rem',
    padding: '0.5rem 0.6rem',
  },
  legend: {
    fontSize: '0.8rem',
    color: '#555',
    padding: '0 0.3rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    fontSize: '0.85rem',
    marginBottom: '0.5rem',
  },
  checkboxField: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.85rem',
    marginBottom: '0.4rem',
  },
  input: {
    padding: '0.35rem 0.5rem',
    border: '1px solid #c8c8c8',
    borderRadius: 4,
    fontSize: '0.85rem',
  },
  error: {
    color: '#b00020',
    background: '#fde7e9',
    padding: '0.45rem 0.6rem',
    borderRadius: 4,
    margin: '0 0 0.6rem',
    overflowWrap: 'anywhere',
  },
  notice: {
    color: '#107c10',
    background: '#edf7ed',
    padding: '0.45rem 0.6rem',
    borderRadius: 4,
    margin: '0 0 0.6rem',
    overflowWrap: 'anywhere',
  },
};
