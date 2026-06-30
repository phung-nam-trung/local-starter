'use strict';

// Indexer edits layer (TG1) — UI-agnostic helpers for the indexer-queue-subscriber repo.
// CONTEXT §7: this repo is not run "as is" — a dev usually edits the test fixtures first
// and then restarts (there is no nodemon). This module:
//   - opens the two test files in the default editor (openTestFiles)
//   - patches test/products.js with a { retailerId, productIds } preset
//   - patches the test:retailer / test:special config (which live in config/default.json,
//     NOT in specials.js — see below) with { retailer, special }
//   - restarts the repo by delegating to runner.restart (keeps --max-old-space-size via
//     `npm start`).
//
// OBSERVED REAL FORMAT (read-only, 2026-06-29):
//   test/products.js — the single ACTIVE line is:
//       new bridges.Products({retailerId: 1249}).index([20097284, 4501409, 4512274, 15799543])
//     (`tests.it.only(...)`); every other Products variant in the file is COMMENTED OUT.
//     The retailerId is a numeric literal; productIds is the array argument to `.index([...])`.
//   test/specials.js — uses `config.get('test:retailer')` and `config.get('test:special')`;
//     it has NO literals to patch. nconf (`config:` separator) resolves `test:retailer` /
//     `test:special` from config/default.json -> { "test": { "retailer": 10, "special": 113930,
//     ... } } (production.json has no `test` block, so default.json always wins). Therefore
//     applySpecialsConfig patches config/default.json, not specials.js.
//
// Safety (CONTEXT §8/§10): every file write is idempotent, makes a `*.bak-<ts>` backup first,
// touches only the target value(s) (the rest of the file stays byte-identical), never logs
// file contents (config/default.json holds secrets), returns SERIALIZABLE objects, never
// throws across IPC. opts.filePath / opts.dir let tests run against COPIES — the real repo
// files are never modified by the verification.

const fs = require('node:fs/promises');
const fsConstants = require('node:fs').constants;
const path = require('node:path');
const { spawn } = require('node:child_process');
const { getRepo } = require('./repos');
const runner = require('./runner');

const INDEXER_ID = 'indexer-queue-subscriber';
const PRODUCTS_REL = path.join('test', 'products.js');
const SPECIALS_REL = path.join('test', 'specials.js');
const SPECIALS_CONFIG_REL = path.join('config', 'default.json');

const isWin = process.platform === 'win32';

function resolveIndexerDir(opts = {}) {
  if (opts.dir) return opts.dir;
  const repo = getRepo(INDEXER_ID);
  if (!repo || !repo.path) {
    throw new Error(`${INDEXER_ID} repo is missing from the registry.`);
  }
  return repo.path;
}

async function statOrNull(filePath) {
  try {
    return await fs.stat(filePath);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

// Same backup-name scheme as env.js (TE1): "<basename>.bak-<UTC stamp>" with a "-N" suffix
// to dodge collisions inside the same second.
function backupTimestamp(now = new Date()) {
  return now.toISOString().replace(/[-:TZ.]/g, '');
}

async function nextBackupPath(filePath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const stamp = backupTimestamp();
  for (let i = 0; i < 100; i += 1) {
    const suffix = i === 0 ? '' : `-${i}`;
    const candidate = path.join(dir, `${base}.bak-${stamp}${suffix}`);
    if (!(await statOrNull(candidate))) return candidate;
  }
  throw new Error(`Could not find an available backup name for ${base}.`);
}

async function backupFile(filePath) {
  const backupPath = await nextBackupPath(filePath);
  await fs.copyFile(filePath, backupPath, fsConstants.COPYFILE_EXCL);
  return path.basename(backupPath);
}

// --- products.js -----------------------------------------------------------

// Normalize productIds input (array of numbers/strings, or a CSV string) into an array of
// positive integers, preserving order and dropping blanks. Throws on a non-integer token so
// we never write garbage into the fixture.
function normalizeProductIds(input) {
  let tokens;
  if (Array.isArray(input)) {
    tokens = input;
  } else if (typeof input === 'string') {
    tokens = input.split(',');
  } else if (input == null) {
    tokens = [];
  } else {
    throw new Error('productIds must be an array or a comma-separated string.');
  }

  const ids = [];
  for (const raw of tokens) {
    const token = String(raw).trim();
    if (token === '') continue;
    if (!/^\d+$/.test(token)) {
      throw new Error(`Invalid productId "${token}" — productIds must be positive integers.`);
    }
    ids.push(Number(token));
  }
  return ids;
}

function normalizeRetailerId(input) {
  const token = String(input == null ? '' : input).trim();
  if (!/^\d+$/.test(token)) {
    throw new Error('retailerId must be a positive integer.');
  }
  return Number(token);
}

// Active-line matcher for the single live Products test. Requires a NUMERIC retailerId and an
// `.index([ ... ])` array — the commented variants use `config.get(...)` / `retailerIds` /
// `.index(undefined, ...)`, so they never match. We also skip whole-line comments below as a
// second guard, so comments are never rewritten.
const PRODUCTS_LINE_RE = /(new\s+bridges\.Products\(\{\s*retailerId:\s*)(\d+)(\s*\}\)\.index\(\[)([^\]]*)(\]\))/;

function patchProductsContent(input, retailerId, productIds) {
  const eol = input.includes('\r\n') ? '\r\n' : '\n';
  const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const hadTrailingNewline = normalized.endsWith('\n');
  const rawLines = normalized.length === 0 ? [] : normalized.split('\n');
  if (hadTrailingNewline) rawLines.pop();

  const idsText = productIds.join(', ');
  let matched = 0;

  const lines = rawLines.map((line) => {
    // Skip whole-line comments — only the active test line should ever be rewritten.
    if (/^\s*\/\//.test(line)) return line;
    if (!PRODUCTS_LINE_RE.test(line)) return line;
    matched += 1;
    return line.replace(
      PRODUCTS_LINE_RE,
      (_m, pre, _rid, mid, _ids, post) => `${pre}${retailerId}${mid}${idsText}${post}`
    );
  });

  const output = hadTrailingNewline ? `${lines.join(eol)}${eol}` : lines.join(eol);
  // Re-join with the original EOL flavour; compare against the raw input to decide `changed`.
  return { content: output, changed: output !== input, matched };
}

async function applyProductsPreset(preset = {}, opts = {}) {
  try {
    const retailerId = normalizeRetailerId(preset.retailerId);
    const productIds = normalizeProductIds(preset.productIds);
    if (productIds.length === 0) {
      return { ok: false, reason: 'invalid-input', changed: false, message: 'productIds is empty.' };
    }

    const filePath = opts.filePath || path.join(resolveIndexerDir(opts), PRODUCTS_REL);
    const stat = await statOrNull(filePath);
    if (!stat || !stat.isFile()) {
      return { ok: false, reason: 'not-found', changed: false, message: `products.js not found: ${filePath}` };
    }

    const original = await fs.readFile(filePath, 'utf8');
    const next = patchProductsContent(original, retailerId, productIds);

    if (next.matched === 0) {
      // The active Products line could not be located — refuse rather than guess.
      return {
        ok: false,
        reason: 'pattern-not-found',
        changed: false,
        message:
          'Could not find the active `new bridges.Products({retailerId: N}).index([...])` line in products.js.',
      };
    }

    if (!next.changed) {
      return {
        ok: true,
        changed: false,
        backupName: null,
        target: PRODUCTS_REL,
        message: `products.js already set to retailerId ${retailerId} (${productIds.length} productIds) — no change.`,
      };
    }

    const backupName = await backupFile(filePath);
    await fs.writeFile(filePath, next.content, 'utf8');

    return {
      ok: true,
      changed: true,
      backupName,
      target: PRODUCTS_REL,
      message: `products.js updated: retailerId ${retailerId}, ${productIds.length} productIds.`,
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      changed: false,
      message: (err && err.message) || String(err),
    };
  }
}

// --- specials config (config/default.json) ---------------------------------

function normalizeConfigInt(value, label) {
  const token = String(value == null ? '' : value).trim();
  if (!/^\d+$/.test(token)) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return Number(token);
}

// Surgical JSON patch: rewrite ONLY "retailer" and/or "special" inside the top-level "test"
// block. The block has no nested objects (its values are numbers and arrays), so a non-greedy
// match up to the first `}` captures exactly it. `"retailer":` (quote-colon adjacency) never
// matches `"retailers":`, and `"special":` never matches `"globalProduct"`/`"product"`. The
// rest of the file stays byte-identical. We re-validate with JSON.parse before writing.
function patchSpecialsContent(input, { retailer, special }) {
  const testBlockRe = /("test"\s*:\s*\{)([\s\S]*?)(\})/;
  const match = input.match(testBlockRe);
  if (!match) {
    return { content: input, changed: false, matched: false };
  }

  let body = match[2];
  if (retailer != null) {
    body = body.replace(/("retailer"\s*:\s*)(\d+)/, `$1${retailer}`);
  }
  if (special != null) {
    body = body.replace(/("special"\s*:\s*)(\d+)/, `$1${special}`);
  }

  const output = `${input.slice(0, match.index)}${match[1]}${body}${match[3]}${input.slice(
    match.index + match[0].length
  )}`;

  return { content: output, changed: output !== input, matched: true };
}

async function applySpecialsConfig(values = {}, opts = {}) {
  try {
    const hasRetailer = values.retailer != null && String(values.retailer).trim() !== '';
    const hasSpecial = values.special != null && String(values.special).trim() !== '';
    if (!hasRetailer && !hasSpecial) {
      return {
        ok: false,
        reason: 'invalid-input',
        changed: false,
        target: SPECIALS_CONFIG_REL,
        message: 'Provide at least one of retailer / special.',
      };
    }

    const retailer = hasRetailer ? normalizeConfigInt(values.retailer, 'retailer') : null;
    const special = hasSpecial ? normalizeConfigInt(values.special, 'special') : null;

    const filePath = opts.filePath || path.join(resolveIndexerDir(opts), SPECIALS_CONFIG_REL);
    const stat = await statOrNull(filePath);
    if (!stat || !stat.isFile()) {
      return {
        ok: false,
        reason: 'not-found',
        changed: false,
        target: SPECIALS_CONFIG_REL,
        message: `config not found: ${filePath}`,
      };
    }

    const original = await fs.readFile(filePath, 'utf8');
    const next = patchSpecialsContent(original, { retailer, special });

    if (!next.matched) {
      return {
        ok: false,
        reason: 'pattern-not-found',
        changed: false,
        target: SPECIALS_CONFIG_REL,
        message: 'Could not find the "test" block in the config file.',
      };
    }

    // Guard: the patched text must still be valid JSON and carry the requested values.
    let parsed;
    try {
      parsed = JSON.parse(next.content);
    } catch (parseErr) {
      return {
        ok: false,
        reason: 'invalid-result',
        changed: false,
        target: SPECIALS_CONFIG_REL,
        message: `Patch would produce invalid JSON: ${(parseErr && parseErr.message) || parseErr}`,
      };
    }
    const test = parsed && parsed.test ? parsed.test : {};
    if (retailer != null && test.retailer !== retailer) {
      return {
        ok: false,
        reason: 'verify-failed',
        changed: false,
        target: SPECIALS_CONFIG_REL,
        message: 'Failed to set test.retailer (no numeric "retailer" key inside the test block?).',
      };
    }
    if (special != null && test.special !== special) {
      return {
        ok: false,
        reason: 'verify-failed',
        changed: false,
        target: SPECIALS_CONFIG_REL,
        message: 'Failed to set test.special (no numeric "special" key inside the test block?).',
      };
    }

    const parts = [];
    if (retailer != null) parts.push(`retailer ${retailer}`);
    if (special != null) parts.push(`special ${special}`);

    if (!next.changed) {
      return {
        ok: true,
        changed: false,
        backupName: null,
        target: SPECIALS_CONFIG_REL,
        message: `config already set (${parts.join(', ')}) — no change.`,
      };
    }

    const backupName = await backupFile(filePath);
    await fs.writeFile(filePath, next.content, 'utf8');

    return {
      ok: true,
      changed: true,
      backupName,
      target: SPECIALS_CONFIG_REL,
      message: `config updated: ${parts.join(', ')}.`,
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      changed: false,
      target: SPECIALS_CONFIG_REL,
      message: (err && err.message) || String(err),
    };
  }
}

// --- open test files -------------------------------------------------------

// Open the two test files in the OS default editor. On Windows we use `cmd /c start "" "<path>"`
// (the empty "" is start's window-title arg; the real path is quoted so spaces are safe). On
// other platforms we fall back to open/xdg-open. Detached + unref so the editor outlives us.
// opts.opener is a TEST hook: it receives the absolute path and returns a plain object instead
// of spawning, so verification can assert the assembled command/paths without popping an editor.
function defaultOpen(filePath) {
  if (isWin) {
    const child = spawn('cmd', ['/c', 'start', '""', filePath], {
      windowsHide: true,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return { tool: 'cmd /c start', argv: ['/c', 'start', '""', filePath] };
  }
  const tool = process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(tool, [filePath], { detached: true, stdio: 'ignore' });
  child.unref();
  return { tool, argv: [filePath] };
}

async function openTestFiles(opts = {}) {
  try {
    const dir = resolveIndexerDir(opts);
    const targets = [path.join(dir, PRODUCTS_REL), path.join(dir, SPECIALS_REL)];
    const open = typeof opts.opener === 'function' ? opts.opener : defaultOpen;

    const opened = [];
    const missing = [];
    for (const filePath of targets) {
      const stat = await statOrNull(filePath);
      if (!stat || !stat.isFile()) {
        missing.push(filePath);
        continue;
      }
      const launched = open(filePath);
      opened.push({ path: filePath, ...(launched && typeof launched === 'object' ? launched : {}) });
    }

    if (opened.length === 0) {
      return { ok: false, reason: 'not-found', opened: [], missing, message: 'No test files found to open.' };
    }
    return {
      ok: true,
      opened,
      missing,
      message:
        missing.length === 0
          ? `Opened ${opened.length} test file(s) in the default editor.`
          : `Opened ${opened.length} test file(s); ${missing.length} missing.`,
    };
  } catch (err) {
    return { ok: false, reason: 'error', opened: [], message: (err && err.message) || String(err) };
  }
}

// --- REST-only toggle (server.js queue.subscribe) --------------------------

// CONTEXT §7: a dev can comment `queue.subscribe()` in server.js to test REST only, without
// consuming the queue. OBSERVED REAL FORMAT (read-only, 2026-06-30): server.js has exactly ONE
// active call line at top level (no indentation):
//       queue.subscribe();
// The `queue` symbol is also `require`d on another line (`queue = require('./lib/queue')`), but
// that line has NO `.subscribe(` so it never matches. We toggle the WHOLE call line by adding /
// removing a `// ` prefix (indent preserved). REST-only = the call is commented.

const SERVER_REL = 'server.js';
// Matches a line whose code part is a `<...>queue.subscribe(...)` CALL — `.subscribe(` (dot +
// paren) excludes the bare `require('./lib/queue')`. The leading group captures indentation and,
// when present, the `// ` we added (we only ever uncomment a line WE commented: a `// ` directly
// in front of the call, optionally after indentation — see SUBSCRIBE_COMMENTED_RE).
const SUBSCRIBE_LINE_RE = /queue\s*\.\s*subscribe\s*\(/;
// A line that is the COMMENTED call: optional indent, then `// ` (our prefix), then the call.
// We only uncomment lines matching this exact shape, so we never disturb prose comments.
const SUBSCRIBE_COMMENTED_RE = /^(\s*)\/\/\s?(.*queue\s*\.\s*subscribe\s*\(.*)$/;

// Split into lines while remembering the EOL flavour + trailing-newline so re-join is
// byte-identical apart from the one line we touch. (Mirrors patchProductsContent.)
function splitLines(input) {
  const eol = input.includes('\r\n') ? '\r\n' : '\n';
  const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const hadTrailingNewline = normalized.endsWith('\n');
  const lines = normalized.length === 0 ? [] : normalized.split('\n');
  if (hadTrailingNewline) lines.pop();
  return { eol, lines, hadTrailingNewline };
}

function joinLines(lines, eol, hadTrailingNewline) {
  return hadTrailingNewline ? `${lines.join(eol)}${eol}` : lines.join(eol);
}

// Inspect server.js text → { found, restOnly }. `found` = a queue.subscribe() call line exists
// (active or commented). `restOnly` = that line is currently commented out.
function inspectRestOnly(input) {
  const { lines } = splitLines(input);
  let found = false;
  let restOnly = false;
  for (const line of lines) {
    if (!SUBSCRIBE_LINE_RE.test(line)) continue;
    found = true;
    // If THIS subscribe line is the commented shape, it's REST-only.
    if (SUBSCRIBE_COMMENTED_RE.test(line)) restOnly = true;
    else restOnly = restOnly || false;
  }
  return { found, restOnly: found ? restOnly : false };
}

// Produce new content for the requested REST-only state. enabled=true → comment the active call
// line; enabled=false → uncomment the commented call line. Idempotent (no-op when already in the
// target state). Returns { content, changed, found }.
function setRestOnlyContent(input, enabled) {
  const { eol, lines, hadTrailingNewline } = splitLines(input);
  let found = false;
  let changed = false;

  const next = lines.map((line) => {
    if (!SUBSCRIBE_LINE_RE.test(line)) return line;
    found = true;
    const commented = SUBSCRIBE_COMMENTED_RE.exec(line);
    if (enabled) {
      // Want it commented. Already commented → leave as-is (idempotent).
      if (commented) return line;
      const indentMatch = /^(\s*)/.exec(line);
      const indent = indentMatch ? indentMatch[1] : '';
      const rest = line.slice(indent.length);
      changed = true;
      return `${indent}// ${rest}`;
    }
    // Want it active. Only uncomment a line WE commented (matches SUBSCRIBE_COMMENTED_RE).
    if (!commented) return line; // already active → idempotent
    changed = true;
    return `${commented[1]}${commented[2]}`; // drop indent's `// ` prefix, keep indent + code
  });

  return { content: joinLines(next, eol, hadTrailingNewline), changed, found };
}

// Read-only state probe. opts.filePath targets a COPY for tests; otherwise the real registry
// path. Returns { ok, found, restOnly } and never throws across IPC.
async function getRestOnlyState(opts = {}) {
  try {
    const filePath = opts.filePath || path.join(resolveIndexerDir(opts), SERVER_REL);
    const stat = await statOrNull(filePath);
    if (!stat || !stat.isFile()) {
      return { ok: false, reason: 'not-found', found: false, restOnly: false, message: `server.js not found: ${filePath}` };
    }
    const content = await fs.readFile(filePath, 'utf8');
    const { found, restOnly } = inspectRestOnly(content);
    return {
      ok: true,
      found,
      restOnly,
      target: SERVER_REL,
      message: found
        ? `queue.subscribe() is currently ${restOnly ? 'COMMENTED (REST-only)' : 'active'}.`
        : 'No queue.subscribe() call line found in server.js.',
    };
  } catch (err) {
    return { ok: false, reason: 'error', found: false, restOnly: false, message: (err && err.message) || String(err) };
  }
}

// Toggle REST-only. enabled=true → comment queue.subscribe(); enabled=false → uncomment it.
// Idempotent (already in target state → changed:false, NO new backup). Backs up `*.bak-<ts>`
// before any write. `pattern-not-found` if no call line exists (never guesses). opts.filePath
// targets a COPY for tests. Returns a serializable result; never throws across IPC.
async function setRestOnly(enabled, opts = {}) {
  try {
    const want = Boolean(enabled);
    const filePath = opts.filePath || path.join(resolveIndexerDir(opts), SERVER_REL);
    const stat = await statOrNull(filePath);
    if (!stat || !stat.isFile()) {
      return { ok: false, reason: 'not-found', changed: false, restOnly: false, message: `server.js not found: ${filePath}` };
    }

    const original = await fs.readFile(filePath, 'utf8');
    const next = setRestOnlyContent(original, want);

    if (!next.found) {
      return {
        ok: false,
        reason: 'pattern-not-found',
        changed: false,
        restOnly: false,
        message: 'Could not find a queue.subscribe() call line in server.js.',
      };
    }

    if (!next.changed) {
      return {
        ok: true,
        changed: false,
        restOnly: want,
        backupName: null,
        target: SERVER_REL,
        message: `queue.subscribe() already ${want ? 'commented (REST-only)' : 'active'} — no change.`,
      };
    }

    const backupName = await backupFile(filePath);
    await fs.writeFile(filePath, next.content, 'utf8');

    return {
      ok: true,
      changed: true,
      restOnly: want,
      backupName,
      target: SERVER_REL,
      message: want
        ? 'queue.subscribe() commented out (REST-only). Restart the indexer to apply.'
        : 'queue.subscribe() restored (active). Restart the indexer to apply.',
    };
  } catch (err) {
    return { ok: false, reason: 'error', changed: false, restOnly: false, message: (err && err.message) || String(err) };
  }
}

// --- restart ---------------------------------------------------------------

// Thin wrapper over runner.restart for the indexer. runner.restart = stop (tree-kill) -> start,
// and start runs `npm start` from the registry (= node --max-old-space-size=3000 ./server.js),
// so the heap flag is preserved. The UI may also call runner.restart directly; this wrapper just
// fixes the repoId so callers can't restart the wrong repo.
function restartIndexer(opts = {}) {
  return runner.restart(INDEXER_ID, opts);
}

module.exports = {
  INDEXER_ID,
  PRODUCTS_REL,
  SPECIALS_REL,
  SPECIALS_CONFIG_REL,
  SERVER_REL,
  applyProductsPreset,
  applySpecialsConfig,
  openTestFiles,
  restartIndexer,
  getRestOnlyState,
  setRestOnly,
  // Exported for unit verification against COPIES (no fs / no spawn).
  patchProductsContent,
  patchSpecialsContent,
  normalizeProductIds,
  inspectRestOnly,
  setRestOnlyContent,
};
