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

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  GATE_SRC,
  IMAGE_GATE_SRC,
  PUBLIC_DATA,
  PUBLIC_IMAGES,
  PUBLIC_IMAGE_DIR,
  SITE_ROOT,
  SOURCE_DATA,
  SOURCE_IMAGES,
  dbCommit,
  dbPath,
  hashFile,
  readManifest,
  renderPublicData,
  renderPublicImages,
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

/* ── 4. The photographs ──────────────────────────────────────────────────── */
// The same three questions as the species data, plus one it does not need.
//
// A manifest predating the image sync has no imageFiles key at all; that is a
// pre-image sync rather than a corrupt one, and re-syncing is the fix either way.

if (manifest.imagesOutputSha !== undefined) {
  const imagesPath = join(SITE_ROOT, PUBLIC_IMAGES);
  if (!existsSync(imagesPath)) {
    fail(`  missing: ${PUBLIC_IMAGES}`, '    run: npm run sync:plants');
  } else if (hashFile(imagesPath) !== manifest.imagesOutputSha) {
    fail(
      `  EDITED HERE: ${PUBLIC_IMAGES}`,
      '    this file is generated from the database by the image gate.',
      '    change the database (or the gate), then: npm run sync:plants',
    );
  }

  if (hashFile(join(SITE_ROOT, IMAGE_GATE_SRC)) !== manifest.imageGateSha) {
    fail(
      `  GATE CHANGED: ${IMAGE_GATE_SRC} differs from the rule the images were built with.`,
      '    a licence or credit rule moved without the images being re-derived.',
      '    re-derive them: npm run sync:plants',
    );
  }

  // The pixels themselves. Species data is one file the outputSha already covers;
  // the images are hundreds of binaries that no other check can see. A derivative
  // swapped, truncated or deleted here would otherwise be invisible until someone
  // loaded the page — and a file in public/plants/ that the index does not list is
  // a photograph still being served after the gate stopped publishing it.
  const expected = new Set();
  for (const file of manifest.imageFiles ?? []) {
    const path = join(SITE_ROOT, file.path);
    expected.add(path);
    if (!existsSync(path)) {
      fail(`  MISSING IMAGE: ${file.path}`, '    run: npm run sync:plants');
    } else if (hashFile(path) !== file.sha256) {
      fail(
        `  CHANGED IMAGE: ${file.path}`,
        '    published derivatives are copies. Re-generate in the database repo,',
        '    then: npm run sync:plants',
      );
    }
  }

  const imageDir = join(SITE_ROOT, PUBLIC_IMAGE_DIR);
  if (existsSync(imageDir)) {
    for (const entry of readdirSync(imageDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      for (const name of readdirSync(join(imageDir, entry.name))) {
        const path = join(imageDir, entry.name, name);
        if (!expected.has(path)) {
          fail(
            `  UNTRACKED IMAGE: ${PUBLIC_IMAGE_DIR}/${entry.name}/${name}`,
            '    not in the gated index — it is being served but nothing publishes it.',
            '    run: npm run sync:plants  (the sync prunes these)',
          );
        }
      }
    }
  }
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

// The images, re-derived the same way. Missing upstream is not a failure: the
// database had no image export before this feature, and an empty photo library
// must not block a build.
if (manifest.imagesOutputSha !== undefined) {
  const imagesSourcePath = join(root, SOURCE_IMAGES);
  const rawImages = existsSync(imagesSourcePath)
    ? readFileSync(imagesSourcePath, 'utf8')
    : null;

  if (sha256(renderPublicImages(rawImages)) !== manifest.imagesOutputSha) {
    const moved = (rawImages ? sha256(rawImages) : null) !== manifest.imagesSourceSha;
    console.error(
      moved
        ? '  STALE: the image index has changed since the last sync'
        : `  STALE: re-deriving no longer reproduces ${PUBLIC_IMAGES}`,
    );
    console.error('  run: npm run sync:plants');
    process.exit(1);
  }
}

console.log(
  `  fresh — gated data reproduces exactly from the database at ${manifest.sourceCommit ?? 'unknown commit'}`,
);
