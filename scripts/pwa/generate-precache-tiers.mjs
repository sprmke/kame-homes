#!/usr/bin/env node
/**
 * Build step: split the emitted bundle into PWA precache tiers.
 *
 *   shell      precached on first install for every visitor (target <= 3 MiB)
 *   host       warmed into the runtime cache after a host signs in / in standalone
 *   on-demand  never precached; runtime-cached (SWR) when a route needs it
 *
 * Why this exists: `vite-plugin-pwa`'s `injectManifest` glob precaches *every*
 * JS/CSS file, so an anonymous guest opening a booking link from Messenger
 * downloaded ~12 MiB of dashboard, PDF, chart and editor code (v1 audit, P0-2).
 * Classification by folder (`features/guest/**` -> shell, `features/dashboard/**`
 * -> host) means a new route lands in a tier by where it lives, never by hand.
 *
 * Reads `ui/dist/.vite/manifest.json` (needs `build.manifest: true`) and writes
 * `ui/dist/precache-tiers.json`, which the service worker fetches once at install
 * and a host-tier warm message reuses later. Config lives in
 * `scripts/pwa/precache-globs.json` — the single source of truth.
 *
 * Run automatically by `bun run build` (vite plugin `closeBundle`, before
 * vite-plugin-pwa generates `sw.js`).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const uiRoot = path.join(repoRoot, 'ui');
const distDir = path.join(uiRoot, 'dist');
const manifestPath = path.join(distDir, '.vite/manifest.json');
const configPath = path.join(repoRoot, 'scripts/pwa/precache-globs.json');

export const TIERS_FILE = 'precache-tiers.json';

/** Numeric precedence: lower wins when a chunk is reachable from several places. */
const TIER = { shell: 0, host: 1, onDemand: 2 };
const TIER_NAMES = ['shell', 'host', 'onDemand'];

function readConfig() {
  const raw = JSON.parse(readFileSync(configPath, 'utf8'));
  return {
    shellBudgetKiB: raw.shellBudgetKiB ?? 3072,
    hostBudgetKiB: raw.hostBudgetKiB ?? 9216,
    totalBudgetKiB: raw.totalBudgetKiB ?? 12288,
    shellSources: raw.shellSources ?? [],
    hostPrefixes: raw.hostPrefixes ?? [],
    onDemandPrefixes: raw.onDemandPrefixes ?? [],
    onDemandPackages: raw.onDemandPackages ?? [],
    shellStatic: raw.shellStatic ?? [],
    globIgnores: raw.globIgnores ?? [],
  };
}

/** Normalized source path relative to `ui/` (`src/features/guest/...`). */
function normalizeSource(key) {
  return key.replace(/\\/g, '/').replace(/^\.?\//, '');
}

/** The `src/...` part of a manifest key (entries under `node_modules` stay bare). */
function sourceRelativeToSrc(key) {
  const normalized = normalizeSource(key);
  if (normalized.startsWith('src/')) return normalized.slice('src/'.length);
  return normalized;
}

function matchesAnyPackage(source, packages) {
  return packages.some((pkg) => source.includes(`node_modules/${pkg}/`));
}

/**
 * Explicit tier from the rules, or `null` when the chunk can only be classified
 * by whoever imports it (Rollup-shared `_config-*.js` chunks, small helpers).
 */
function explicitTier(key, cfg) {
  const normalized = normalizeSource(key);
  const source = sourceRelativeToSrc(key);
  if (matchesAnyPackage(normalized, cfg.onDemandPackages)) return 'onDemand';
  if (cfg.onDemandPrefixes.some((prefix) => source.startsWith(prefix))) return 'onDemand';
  if (cfg.shellSources.some((entry) => source.includes(entry))) return 'shell';
  if (cfg.hostPrefixes.some((prefix) => source.startsWith(prefix))) return 'host';
  // Everything else that is first-party guest/account code is shell.
  if (source.startsWith('features/')) return 'shell';
  if (source === 'main.tsx' || source === 'App.tsx') return 'shell';
  return null;
}

/** Content-hashed filenames never need a revision — the URL itself changes. */
function isContentHashed(rel) {
  return /-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?)$/.test(rel);
}

function revisionFor(absPath, rel) {
  if (isContentHashed(rel)) return null;
  const hash = createHash('sha256').update(readFileSync(absPath)).digest('hex');
  return hash.slice(0, 16);
}

function walk(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

/** Very small glob → RegExp (supports `**`, `*`, `?`, `{a,b}`, `.`). Mirrors the budget script. */
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i += 1;
        if (glob[i + 1] === '/') i += 1;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') re += '[^/]';
    else if (c === '.') re += '\\.';
    else if (c === '{') {
      const end = glob.indexOf('}', i);
      re += `(${glob
        .slice(i + 1, end)
        .split(',')
        .join('|')})`;
      i = end;
    } else re += c.replace(/[+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export function generatePrecacheTiers({ log = console.log, warn = console.warn } = {}) {
  if (!existsSync(manifestPath)) {
    throw new Error(
      `[precache-tiers] ${path.relative(repoRoot, manifestPath)} not found. Set \`build.manifest: true\` in ui/vite.config.ts.`
    );
  }
  const cfg = readConfig();
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const ignoreRes = cfg.globIgnores.map(globToRegExp);

  /** file (relative to dist) -> { own, imports[], css[], isEntry } */
  const chunks = new Map();
  for (const [key, record] of Object.entries(manifest)) {
    if (!record?.file) continue;
    const normalizeImport = (value) => manifest[value]?.file ?? value;
    chunks.set(record.file, {
      key,
      own: explicitTier(key, cfg),
      imports: [...(record.imports ?? [])].map(normalizeImport),
      css: [...(record.css ?? [])],
      isEntry: Boolean(record.isEntry),
    });
  }

  /**
   * Tier resolution. Rollup emits shared chunks under a synthetic key
   * (`_config-*.js`), so the only honest signal is the import graph: a chunk
   * inherits the *lightest* tier of everything that imports it. The HTML entry and
   * every explicitly-shell chunk seed the shell tier; an on-demand library reached
   * from shell code is promoted back to shell (correctness beats the diet) and
   * reported.
   */
  const importedBy = new Map();
  for (const [file, info] of chunks) {
    for (const dep of info.imports) {
      if (!importedBy.has(dep)) importedBy.set(dep, new Set());
      importedBy.get(dep).add(file);
    }
  }

  const tierByFile = new Map();
  for (const [file, info] of chunks) {
    if (info.own) tierByFile.set(file, TIER[info.own]);
  }
  const htmlEntry = manifest['index.html']?.file;
  if (htmlEntry) tierByFile.set(htmlEntry, TIER.shell);

  for (let pass = 0; pass < 12; pass += 1) {
    let changed = false;
    for (const file of chunks.keys()) {
      if (tierByFile.has(file)) continue;
      let lowest = Infinity;
      for (const importer of importedBy.get(file) ?? []) {
        const value = tierByFile.get(importer);
        if (value !== undefined && value < lowest) lowest = value;
      }
      if (lowest !== Infinity) {
        tierByFile.set(file, lowest);
        changed = true;
      }
    }
    if (!changed) break;
  }
  // Unreferenced chunks (shouldn't happen) stay in the host tier rather than
  // silently disappearing from every cache.
  for (const file of chunks.keys()) {
    if (!tierByFile.has(file)) tierByFile.set(file, TIER.host);
  }

  const promoted = [];
  for (const [file, info] of chunks) {
    if (info.own === 'onDemand' && tierByFile.get(file) === TIER.shell) promoted.push(file);
  }

  const tiers = { shell: [], host: [], onDemand: [] };
  const byTier = { shell: [], host: [], onDemand: [] };
  const seen = new Set();

  const pushEntry = (tier, rel) => {
    if (seen.has(rel)) return;
    if (ignoreRes.some((re) => re.test(rel))) return;
    seen.add(rel);
    const abs = path.join(distDir, rel);
    if (!existsSync(abs)) {
      warn(`[precache-tiers] missing ${rel} — skipped`);
      return;
    }
    const bytes = statSync(abs).size;
    tiers[tier].push({ url: `/${rel}`, revision: revisionFor(abs, rel), bytes });
    byTier[tier].push({ rel, bytes });
  };

  const cssTier = new Map();
  for (const [file, info] of chunks) {
    const tier = TIER_NAMES[tierByFile.get(file) ?? TIER.host];
    pushEntry(tier, file);
    for (const css of info.css) {
      const existing = cssTier.get(css);
      if (existing === undefined || TIER[tier] < TIER[existing]) cssTier.set(css, tier);
    }
  }
  for (const [css, tier] of cssTier) pushEntry(tier, css);

  // Any emitted asset that never appears in the manifest still has to be
  // reachable offline if it is part of the shell's static contract.
  for (const rel of cfg.shellStatic) pushEntry('shell', rel);

  for (const tier of Object.keys(tiers)) {
    tiers[tier].sort((a, b) => a.url.localeCompare(b.url));
    byTier[tier].sort((a, b) => b.bytes - a.bytes);
  }

  const sum = (list) => list.reduce((total, entry) => total + entry.bytes, 0);
  const output = {
    buildId: Number(process.env.PWA_BUILD_ID ?? 0) || 0,
    generatedAt: new Date().toISOString(),
    budgetsKiB: {
      shell: cfg.shellBudgetKiB,
      host: cfg.hostBudgetKiB,
      total: cfg.totalBudgetKiB,
    },
    shell: tiers.shell,
    host: tiers.host,
    onDemand: tiers.onDemand,
  };
  writeFileSync(path.join(distDir, TIERS_FILE), `${JSON.stringify(output)}\n`);

  const kib = (value) => (value / 1024).toFixed(1);
  log(
    `[precache-tiers] shell ${tiers.shell.length} files / ${kib(sum(byTier.shell))} KiB ` +
      `· host ${tiers.host.length} files / ${kib(sum(byTier.host))} KiB ` +
      `· on-demand ${tiers.onDemand.length} files / ${kib(sum(byTier.onDemand))} KiB`
  );
  for (const tier of ['shell', 'host', 'onDemand']) {
    for (const entry of byTier[tier].slice(0, 5)) {
      log(`  ${tier.padEnd(9)} ${kib(entry.bytes).padStart(9)} KiB  ${entry.rel}`);
    }
  }
  if (promoted.length) {
    warn(
      `[precache-tiers] ${promoted.length} on-demand chunk(s) are statically imported by shell code and were promoted to shell: ${promoted.join(', ')}`
    );
  }
  return output;
}

/** `vite build` runs this script directly; the plugin calls the export. */
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    generatePrecacheTiers();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
