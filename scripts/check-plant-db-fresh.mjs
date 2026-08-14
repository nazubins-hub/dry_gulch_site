#!/usr/bin/env node
//
// Guard the gated plant data against drifting out of step.
//
//   node scripts/check-plant-db-fresh.mjs
//
// data/plants.public.json is DERIVED — the database's plants.json passed through
// src/lib/publish-gate.js. So there are three ways it can go stale, and this checks
// all three:
//
//   hand-edited here   the output no longer matches what sync wrote
//   the gate changed   the rule moved but the data was not re-derived
//   the database moved new species or corrected ratings upstream
//
// The first two are checkable without the database repo and so run everywhere,
// including on Cloudflare. The third needs the source; when it is absent that step
// is skipped with a notice rather than failing, because Cloudflare builds from
// GitHub and can never see it.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GATE_SRC,
  PUBLIC_DATA,
  SITE_ROOT,
  SOURCE_DATA,
  dbCommit,
  dbPath,
  hashFile,
  readManifest,
  renderPublicData,
  sha256,
} from './plant-db-common.mjs';

const manifest = readManifest();

if (!manifest) {
  console.error('  no sync manifest — the plant database has never been synced.');
  console.error('  run: npm run sync:plants');
  process.exit(1);
}

let failed = false;
const fail = (...lines) => {
  failed = true;
  for (const l of lines) console.error(l);
};

/* ── 1. Verbatim UI files ────────────────────────────────────────────────── */

for (const file of manifest.files ?? []) {
  const dest = join(SITE_ROOT, file.to);
  if (!existsSync(dest)) fail(`  missing synced file: ${file.to}`);
  else if (hashFile(dest) !== file.sha256) {
    fail(
      `  EDITED HERE: ${file.to}`,
      '    this file is a copy. Change it in the plant database repo,',
      '    then re-run: npm run sync:plants',
    );
  }
}

/* ── 2. The gated data itself ────────────────────────────────────────────── */

const publicPath = join(SITE_ROOT, PUBLIC_DATA);
if (!existsSync(publicPath)) {
  fail(`  missing: ${PUBLIC_DATA}`, '    run: npm run sync:plants');
} else if (hashFile(publicPath) !== manifest.outputSha) {
  fail(
    `  EDITED HERE: ${PUBLIC_DATA}`,
    '    this file is generated from the database by the publish gate.',
    '    change the database (or the gate), then: npm run sync:plants',
  );
}

/* ── 3. The gate rule ────────────────────────────────────────────────────── */
// Catches "someone changed what may be published but did not re-derive the data".
// Previously invisible without the source repo, so it never ran on CI.

if (hashFile(join(SITE_ROOT, GATE_SRC)) !== manifest.gateSha) {
  fail(
    `  GATE CHANGED: ${GATE_SRC} differs from the rule the data was built with.`,
    '    the published data may no longer reflect the current rule.',
    '    re-derive it: npm run sync:plants',
  );
}

if (failed) process.exit(1);

/* ── 4. The upstream database (local only) ───────────────────────────────── */

const root = dbPath();

if (!root) {
  console.log('  PLANT_DB_PATH not set — skipping upstream freshness check.');
  console.log('  (normal on CI; the checks above already ran)');
  process.exit(0);
}

if (!existsSync(root)) {
  console.log('  plant database not present — skipping upstream freshness check.');
  console.log(`  (PLANT_DB_PATH=${root}; normal on CI)`);
  process.exit(0);
}

const sourcePath = join(root, SOURCE_DATA);
if (!existsSync(sourcePath)) {
  console.error(`  missing in the database repo: ${SOURCE_DATA}`);
  process.exit(1);
}

const raw = readFileSync(sourcePath, 'utf8');

// Re-derive rather than compare hashes: this proves the committed output is exactly
// what the current gate produces from the current source, which subsumes both
// "database moved" and "gate changed" in a single byte-for-byte comparison.
if (sha256(renderPublicData(raw)) !== manifest.outputSha) {
  const moved = sha256(raw) !== manifest.sourceSha;
  console.error(
    moved
      ? `  STALE: the database has changed since the last sync`
      : `  STALE: re-deriving the data no longer reproduces ${PUBLIC_DATA}`,
  );
  console.error(
    `  synced from ${manifest.sourceCommit ?? 'unknown'}; database is now at ${dbCommit(root) ?? 'unknown'}`,
  );
  console.error('  run: npm run sync:plants');
  process.exit(1);
}

console.log(
  `  fresh — gated data reproduces exactly from the database at ${manifest.sourceCommit ?? 'unknown commit'}`,
);
