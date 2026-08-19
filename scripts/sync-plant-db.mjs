#!/usr/bin/env node
//
// Pull the plant database into this repo — gated.
//
//   node scripts/sync-plant-db.mjs
//   PLANT_DB_PATH=/some/other/checkout node scripts/sync-plant-db.mjs
//
// Cloudflare Pages builds from GitHub and cannot see the database repo, so what the
// site needs has to be committed here. What it needs is NOT the database: it is the
// gated projection of it. The raw plants.json is read, passed through
// src/lib/publish-gate.js in memory, and only the result is written to disk.
//
// The estimated fire ratings therefore never exist as a file in this repo. That
// matters because this repo is public and `ign: 8` survives scraping and reshaping
// far better than the `ignSrc: "est"` qualifier beside it — and every one of the
// twelve estimates later checked against a published source was revised downward
// out of its clearance to sit within 30 ft of a structure.
//
// The manifest records three hashes so the freshness check can tell the difference
// between the database moving on, the gate rule changing, and someone editing the
// output by hand.

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import {
  GATE_SRC,
  IMAGE_BYTE_WARN,
  IMAGE_GATE_SRC,
  MANIFEST,
  NO_DB_PATH,
  PUBLIC_DATA,
  PUBLIC_IMAGES,
  PUBLIC_IMAGE_DIR,
  PUBLISHED_SIZES,
  SITE_ROOT,
  SOURCE_DATA,
  SOURCE_IMAGES,
  SYNCED,
  dbCommit,
  dbDirtyPaths,
  dbPath,
  hashFile,
  renderPublicData,
  renderPublicImages,
  sha256,
} from './plant-db-common.mjs';
import { withheldCounts } from '../src/lib/publish-gate.js';
import { gateImages } from '../src/lib/image-gate.js';

const root = dbPath();

if (!root) {
  console.error(NO_DB_PATH);
  process.exit(1);
}

if (!existsSync(root)) {
  console.error(`  plant database not found at:\n    ${root}`);
  console.error('  check PLANT_DB_PATH and try again.');
  process.exit(1);
}

// The database generates its .jsx from plants.json. A stale generated file means the
// UI template may not match the data it renders.
try {
  execFileSync('python3', ['scripts/render_jsx.py', '--check'], { cwd: root, stdio: 'pipe' });
} catch {
  console.error("  the database's generated UI is stale against plants.json.");
  console.error('  regenerate it in the database repo first:');
  console.error(`    cd "${root}" && python3 scripts/render_jsx.py`);
  process.exit(1);
}

const dirty = dbDirtyPaths(root);
if (dirty.length) {
  console.warn('  WARNING: the database repo has uncommitted changes:');
  for (const line of dirty.slice(0, 10)) console.warn(`    ${line}`);
  if (dirty.length > 10) console.warn(`    ...and ${dirty.length - 10} more`);
  console.warn('  syncing anyway; the recorded commit will not reflect them.\n');
}

/* ── UI, copied verbatim ─────────────────────────────────────────────────── */

const files = [];
for (const { from, to } of SYNCED) {
  const src = join(root, from);
  const dest = join(SITE_ROOT, to);
  if (!existsSync(src)) {
    console.error(`  missing in the database repo: ${from}`);
    process.exit(1);
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  files.push({ from, to, sha256: hashFile(dest) });
  console.log(`  ${from}  ->  ${to}`);
}

/* ── Species data, gated ─────────────────────────────────────────────────── */

const sourcePath = join(root, SOURCE_DATA);
if (!existsSync(sourcePath)) {
  console.error(`  missing in the database repo: ${SOURCE_DATA}`);
  process.exit(1);
}

const raw = readFileSync(sourcePath, 'utf8');
const publicJson = renderPublicData(raw);
const gated = JSON.parse(publicJson);

// Refuse to write data that contradicts the gate. A withheld rating that still
// carries a value would put the estimate in the repo, which is the whole point of
// this script.
const leaked = gated.filter((p) => p.ignWithheld && p.ign !== null);
const srcLeaked = gated.filter((p) => p.ignSrc === 'est');
if (leaked.length || srcLeaked.length) {
  console.error(`  GATE FAILURE — refusing to write ${PUBLIC_DATA}`);
  console.error(`    ${leaked.length} withheld rating(s) still carry a value`);
  console.error(`    ${srcLeaked.length} record(s) still marked ignSrc "est"`);
  process.exit(1);
}

const publicPath = join(SITE_ROOT, PUBLIC_DATA);
mkdirSync(dirname(publicPath), { recursive: true });
writeFileSync(publicPath, publicJson);

const counts = withheldCounts(gated);
console.log(
  `  ${SOURCE_DATA}  ->  ${PUBLIC_DATA}  (gated: ${counts.ign} ratings, ${counts.culture} cultural notes withheld)`,
);

/* ── Photographs, gated ──────────────────────────────────────────────────── */
//
// The database's image manifest holds the capture coordinates of every photograph.
// What crosses here is its allowlisted projection — no coordinates, no field notes,
// no path to the original — passed through src/lib/image-gate.js on the way in. The
// pixels are the stripped derivatives; the full-resolution masters never leave the
// database repo.

const imagesSourcePath = join(root, SOURCE_IMAGES);
const rawImages = existsSync(imagesSourcePath) ? readFileSync(imagesSourcePath, 'utf8') : null;

if (!rawImages) {
  console.log(`  ${SOURCE_IMAGES} not present — writing an empty image index.`);
  console.log('  (run `python3 scripts/build.py` in the database to generate it)');
}

// Two shapes of the same set. `sourceImages` still carries the database's own
// derivative paths, which is what the copy loop needs; the written index carries
// public URLs and only the sizes that actually cross.
const { published: sourceImages, refused: refusedImages } = gateImages(
  rawImages ? JSON.parse(rawImages) : { images: [] },
);
const imagesJson = renderPublicImages(rawImages);

writeFileSync(join(SITE_ROOT, PUBLIC_IMAGES), imagesJson);

/**
 * Does this file carry an EXIF or XMP block?
 *
 * The last check between a client's GPS coordinates and a public GitHub repo. The
 * database strips metadata when it writes the derivatives and its verify.py asserts
 * so, but this repo is the one that publishes them, and a check that only runs
 * upstream is a check that stops running the moment something else writes a file
 * into derived/.
 *
 * A WebP is a RIFF container: a flat sequence of FourCC + little-endian length. The
 * database's verify.py reads it exactly this way; both implement the same rule
 * because a rule enforced by reading bytes can be implemented in any language.
 */
function metadataBytes(buf) {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF') return 0;
  if (buf.toString('ascii', 8, 12) !== 'WEBP') return 0;
  let off = 12;
  let total = 0;
  while (off + 8 <= buf.length) {
    const fourcc = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (fourcc === 'EXIF' || fourcc === 'XMP ') total += size;
    off += 8 + size + (size % 2); // chunks are word-aligned
  }
  return total;
}

const imageDir = join(SITE_ROOT, PUBLIC_IMAGE_DIR);
mkdirSync(imageDir, { recursive: true });

const imageFiles = [];
let imageBytes = 0;

for (const img of sourceImages) {
  for (const size of PUBLISHED_SIZES) {
    const derivative = img.derivatives?.[size];
    if (!derivative) continue;

    const from = join(root, derivative.path);
    if (!existsSync(from)) {
      console.error(`  missing derivative for ${img.id}: ${derivative.path}`);
      console.error('  rebuild it in the database repo, then re-sync.');
      process.exit(1);
    }

    const bytes = readFileSync(from);
    const meta = metadataBytes(bytes);
    if (meta) {
      console.error(`  REFUSING to publish ${derivative.path}`);
      console.error(`    it carries ${meta} bytes of EXIF/XMP, which may hold GPS.`);
      console.error('    a capture location is a client address. Re-generate the');
      console.error('    derivative in the database repo before syncing.');
      process.exit(1);
    }

    const rel = `${PUBLIC_IMAGE_DIR}/${img.id}/${size}.webp`;
    mkdirSync(join(imageDir, img.id), { recursive: true });
    writeFileSync(join(SITE_ROOT, rel), bytes);
    imageFiles.push({ path: rel, sha256: sha256(bytes), bytes: bytes.length });
    imageBytes += bytes.length;
  }
}

// Prune anything the gate no longer publishes. Without this a superseded photo — or
// one a licence review later refused — would keep sitting at its URL, served to
// anyone who had the link and invisible to every page that stopped referencing it.
const keep = new Set(imageFiles.map((f) => join(SITE_ROOT, f.path)));
let pruned = 0;
for (const entry of existsSync(imageDir) ? readdirSync(imageDir, { withFileTypes: true }) : []) {
  const dir = join(imageDir, entry.name);
  if (!entry.isDirectory()) continue;
  for (const file of readdirSync(dir)) {
    if (!keep.has(join(dir, file))) {
      rmSync(join(dir, file));
      pruned += 1;
    }
  }
  if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
console.log(
  `  ${SOURCE_IMAGES}  ->  ${PUBLIC_IMAGES}  ` +
    `(${sourceImages.length} published, ${refusedImages.length} refused)`,
);
console.log(
  `  ${imageFiles.length} file(s) -> ${PUBLIC_IMAGE_DIR}/  ${mb(imageBytes)}` +
    (pruned ? `, ${pruned} pruned` : ''),
);
for (const r of refusedImages) console.log(`    refused ${r.id}: ${r.reason}`);

if (imageBytes > IMAGE_BYTE_WARN) {
  console.warn(`\n  WARNING: committed imagery is ${mb(imageBytes)}, past the`);
  console.warn(`  ${mb(IMAGE_BYTE_WARN)} tripwire. This repo is what Cloudflare builds from.`);
  console.warn('  Consider re-tuning WebP quality in the database\'s ingest.py,');
  console.warn('  or publishing thumb only for secondary roles.\n');
}

/* ── Manifest ────────────────────────────────────────────────────────────── */

writeFileSync(
  MANIFEST,
  `${JSON.stringify(
    {
      _comment:
        'Generated by scripts/sync-plant-db.mjs. The plant database is the source of ' +
        'truth for every species fact; edit it there, never here. plants.public.json ' +
        'is a GATED projection — it deliberately omits unpublished fire ratings and ' +
        'unverified cultural notes.',
      // No `source` path here on purpose: this file is committed to a public repo,
      // and the absolute path would publish a username and directory layout.
      // sourceCommit identifies what was synced, which is the part that matters.
      sourceCommit: dbCommit(root),
      sourceDirty: dirty.length > 0,
      syncedAt: new Date().toISOString(),
      // the upstream file we derived from — detects the database moving on
      sourceSha: sha256(raw),
      // what we wrote — detects hand-editing of the output
      outputSha: sha256(publicJson),
      // the rule we applied — detects the gate changing without a re-sync
      gateSha: hashFile(join(SITE_ROOT, GATE_SRC)),
      files,
      // The same three questions for the photographs: did the database's export
      // move, was the output edited here, did the image rule change without a
      // re-sync. imageFiles additionally pins the pixels, so a derivative deleted
      // or swapped in this repo is detectable — the species data has no
      // equivalent because it is a single file the outputSha already covers.
      imagesSourceSha: rawImages ? sha256(rawImages) : null,
      imagesOutputSha: sha256(imagesJson),
      imageGateSha: hashFile(join(SITE_ROOT, IMAGE_GATE_SRC)),
      imageFiles,
    },
    null,
    2,
  )}\n`,
);

console.log(`  synced at ${dbCommit(root) ?? 'unknown commit'}`);
