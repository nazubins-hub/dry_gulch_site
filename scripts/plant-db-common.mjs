// Shared helpers for the plant-database sync scripts.
//
// The database lives in its own git repo outside this one. Its governing rule is
// that every fact has exactly one home: plants.json. These scripts copy that data
// in as a build input without ever making the copy authoritative — the sync
// manifest records where each file came from and what it hashed to, so drift in
// either direction is detectable.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gateAll } from '../src/lib/publish-gate.js';

export const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Where the plant database is checked out.
 *
 * Deliberately NOT defaulted to an absolute path: this repo is public, and a
 * hardcoded default would publish a username and home-directory layout. Callers
 * that need the database must be told where it is.
 *
 * Returns null when unset — callers decide whether that is fatal (sync, audit) or
 * simply means "skip the upstream check" (the freshness check on CI).
 */
export const dbPath = () => process.env.PLANT_DB_PATH || null;

/** Message for the commands that cannot work without the database. */
export const NO_DB_PATH = [
  '  PLANT_DB_PATH is not set — I do not know where the plant database is.',
  '  point it at your xeric-plant-system checkout, e.g.',
  '    PLANT_DB_PATH=/path/to/xeric-plant-system npm run sync:plants',
].join('\n');

export const MANIFEST = join(SITE_ROOT, 'data', '.plant-db-sync.json');

// source path (relative to the DB repo) -> destination path (relative to here)
//
// Files copied through VERBATIM. Only UI belongs here — never species data.
//
// We sync the UI TEMPLATE, not the database's generated out/xeric-plant-db.jsx.
// That generated file has the full dataset baked in, including the estimated fire
// ratings the publish gate withholds — there would be no way to feed it gated
// data. The template carries a /* __PLANTS__ */ placeholder instead, so
// build-island.mjs injects exactly what may be published.
export const SYNCED = [
  { from: 'ui/template.jsx', to: 'src/components/XericPlantDB.template.jsx' },
];

/** Species data in the database repo. Read, gated, never copied verbatim. */
export const SOURCE_DATA = 'plants.json';

/**
 * The only species data this repo holds: the gated projection of plants.json.
 *
 * This repo is public. A verbatim copy would put all 41 estimated fire ratings on
 * GitHub as structured data, where `ign: 8` survives scraping and reshaping far
 * better than the `ignSrc: "est"` qualifier sitting in a neighbouring field. The
 * repo is a deployment artifact, not a data release, so it carries only what the
 * site is allowed to say.
 */
export const PUBLIC_DATA = 'data/plants.public.json';

/** The gate itself is hashed into the manifest: change the rule, re-sync the data. */
export const GATE_SRC = 'src/lib/publish-gate.js';

/** Where build-island.mjs writes the mounted component. Generated, gitignored. */
export const ISLAND_OUT = 'src/components/XericPlantDB.generated.jsx';

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export const hashFile = (path) => sha256(readFileSync(path));

/**
 * Render the public data file from the database's raw plants.json.
 *
 * Shared by sync (which writes it) and the freshness check (which re-derives it and
 * compares). Both must produce byte-identical output for the comparison to mean
 * anything, so the serialization lives here rather than being written twice.
 */
export function renderPublicData(rawPlantsJson) {
  return `${JSON.stringify(gateAll(JSON.parse(rawPlantsJson)), null, 2)}\n`;
}

/** Short HEAD hash of the database repo, or null if git can't tell us. */
export function dbCommit(root) {
  try {
    return execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/** Uncommitted paths in the database repo. Empty array means a clean tree. */
export function dbDirtyPaths(root) {
  try {
    return execFileSync('git', ['-C', root, 'status', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

export const readManifest = () =>
  existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : null;
