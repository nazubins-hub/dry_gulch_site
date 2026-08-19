#!/usr/bin/env node
//
// Report the data the plant database's own rules say to review before publishing.
//
//   node scripts/publish-audit.mjs
//
// Two populations, from the database's CLAUDE.md:
//
//   1. Estimated ignitability ratings that clear Home Ignition Zones 1-2.
//      The scale reads backwards from intuition: HIGHER = harder to ignite, and
//      only 8+ may go within 30 ft of a structure. An *estimated* 8+ is therefore
//      an unverified claim that a plant is safe close to a house. The database's
//      README calls this "the highest-consequence unverified data in the project."
//
//   2. Cultural notes flagged `V` — commonly repeated, not well sourced.
//      CLAUDE.md: `V` "must never reach published output" without a NAEB check.
//
// This reads the DATABASE, not the site's data file. It has to: the site's copy is
// gated, and the fields this audit reports on are exactly the ones the gate removes.
// Auditing the gated file would always report zero findings — a clean bill of health
// that means nothing. So this is a local-only tool, and it refuses to run without the
// database rather than reporting a comfortable, false result.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_DB_PATH, SOURCE_DATA, SOURCE_IMAGES, dbPath, readManifest } from './plant-db-common.mjs';
import { gateImages } from '../src/lib/image-gate.js';

const root = dbPath();

if (!root) {
  console.error(NO_DB_PATH.replace('sync:plants', 'audit:plants'));
  process.exit(1);
}

if (!existsSync(join(root, SOURCE_DATA))) {
  console.error('  the publish audit needs the plant database, which is not present.');
  console.error(`    expected: ${join(root, SOURCE_DATA)}`);
  console.error('  it reports on the estimated ratings and unverified cultural notes');
  console.error('  that this repo deliberately does not contain, so it cannot run');
  console.error('  against the site data. Set PLANT_DB_PATH and re-run.');
  process.exit(1);
}

const plants = JSON.parse(readFileSync(join(root, SOURCE_DATA), 'utf8'));
const manifest = readManifest();

const rule = (s) => console.log(`\n${'─'.repeat(78)}\n${s}\n${'─'.repeat(78)}`);

console.log(`\nPUBLISH AUDIT — ${plants.length} species`);
console.log(
  `source: ${manifest?.sourceCommit ?? 'unknown'}  synced: ${manifest?.syncedAt ?? 'unknown'}`,
);

const by = (key) =>
  plants.reduce((acc, p) => {
    const k = p[key] ?? '(none)';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

console.log('\nignSrc   ', JSON.stringify(by('ignSrc')));
console.log('cultureSrc', JSON.stringify(by('cultureSrc')));

const estHiz = plants
  .filter((p) => p.ignSrc === 'est' && (p.ign ?? 0) >= 8)
  .sort((a, b) => b.ign - a.ign || a.common.localeCompare(b.common));

rule(
  `1. ESTIMATED ignitability clearing HIZ 1-2  (ignSrc "est" AND ign >= 8)   ${estHiz.length} species`,
);
console.log(
  '   Published as safe within 30 ft of a structure on an estimate, not a source.\n',
);
console.log(
  `   ${'id'.padStart(3)}  ${'common'.padEnd(36)} ${'botanical'.padEnd(34)} ign  type`,
);
for (const p of estHiz) {
  console.log(
    `   ${String(p.id).padStart(3)}  ${p.common.padEnd(36)} ${p.sci.padEnd(34)} ${String(p.ign).padStart(3)}  ${p.type}`,
  );
}

const vFlagged = plants
  .filter((p) => p.cultureSrc === 'V')
  .sort((a, b) => a.common.localeCompare(b.common));

rule(`2. UNVERIFIED cultural notes  (cultureSrc "V")   ${vFlagged.length} species`);
console.log('   CLAUDE.md: must never reach published output without a NAEB check.');
console.log('   Check at naeb.brit.org before publishing the `culture` text.\n');
for (const p of vFlagged) {
  console.log(`   ${String(p.id).padStart(3)}  ${p.common}  (${p.sci})`);
  console.log(`        ign ${p.ign} (${p.ignSrc})`);
  console.log(`        "${p.culture}"\n`);
}

const both = estHiz.filter((p) => p.cultureSrc === 'V');
if (both.length) {
  rule(`3. IN BOTH LISTS   ${both.length} species`);
  console.log('   These exercise both gating rules at once — useful for verification.\n');
  for (const p of both) console.log(`   ${String(p.id).padStart(3)}  ${p.common}`);
}

/* ── Photographs ─────────────────────────────────────────────────────────── */
//
// A photograph is a different kind of publication risk from a species fact. It can
// carry a licence you are not entitled to, and it can show a place you were invited
// into rather than one you own. Neither is visible in the JSON at a glance, so both
// get listed here, before a deploy rather than after.

const imagesSourcePath = join(root, SOURCE_IMAGES);
const rawImages = existsSync(imagesSourcePath) ? readFileSync(imagesSourcePath, 'utf8') : null;
const { published: publishedImages, refused: refusedImages } = gateImages(
  rawImages ? JSON.parse(rawImages) : { images: [] },
);

const bySci = Object.fromEntries(plants.map((p) => [p.sci, p]));
const commonOf = (img) => bySci[img.sci]?.common ?? img.sci;

const installed = publishedImages
  .filter((i) => i.site?.context === 'installed')
  .sort((a, b) => commonOf(a).localeCompare(commonOf(b)));

rule(`4. PHOTOGRAPHS ON A CLIENT'S PROPERTY  (site.context "installed")   ${installed.length}`);
console.log("   These show someone else's landscape on a public marketing site.");
console.log('   Nothing blocks them — an installed shot is the one that converts —');
console.log('   but you should know what is going public before it does.\n');
if (installed.length === 0) {
  console.log('   none.\n');
}
for (const img of installed) {
  console.log(`   ${img.id}`);
  console.log(`        ${commonOf(img)} · ${img.role} · tier ${img.tier} · ${img.capturedAt ?? 'undated'}`);
}

rule(`5. IMAGES REFUSED BY THE GATE   ${refusedImages.length}`);
console.log('   Present in the database, held out of the site by src/lib/image-gate.js.\n');
if (refusedImages.length === 0) {
  console.log('   none — everything the database exports is publishable.\n');
}
for (const r of refusedImages) {
  console.log(`   ${r.id}`);
  console.log(`        ${r.reason}`);
}

const manifestImages = manifest?.imageFiles ?? [];
const totalBytes = manifestImages.reduce((n, f) => n + f.bytes, 0);
rule('COMMITTED IMAGERY');
console.log(
  `   ${publishedImages.length} image(s) published, ${manifestImages.length} file(s) committed, ` +
    `${(totalBytes / 1024 / 1024).toFixed(1)} MB.`,
);
console.log('   Only thumb and card cross; full-resolution masters stay in the database.');
console.log('   Capture coordinates are never synced — see PRIVATE_FIELDS in image-gate.js.\n');

const verified = plants.filter((p) => p.ignSrc === 'CSU' || p.ignSrc === 'IDFW');
rule('IF YOU PUBLISH ONLY SOURCE-BACKED RATINGS');
console.log(
  `   ${verified.length} of ${plants.length} species have a published (CSU or IDFW) ignitability rating.`,
);
console.log(
  `   ${plants.length - verified.length} would be withheld, of which ${estHiz.length} are the HIZ-clearing ones above.\n`,
);
