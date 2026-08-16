// What may be said in public about a species, and what may not.
//
// The plant database holds facts at several confidence levels. Two of them are
// not safe to publish as stated, and this module is the single place that decides
// so — both the species pages and (once its UI supports an unrated state) the
// interactive browser read the gate from here.
//
// The rules key on PROVENANCE FIELDS, never on a list of species names. The
// database is actively retiring estimates; a name list would go stale the moment
// it does, while an ignSrc check publishes each correction automatically on the
// next sync.

/**
 * Ignitability values that come from a published source rather than an estimate.
 *
 * Exported so scripts/build-island.mjs can assert it still matches the set the
 * database emits in data/site-rules.json. The same rule necessarily exists in
 * both repos — neither can import the other — and the two drifting apart would
 * mean the species pages and the site-tuning panel beside them disagreeing about
 * which plants are safe within 30 ft of a structure.
 */
export const PUBLISHED_IGN_SOURCES = new Set(['CSU', 'IDFW']);

/**
 * Is this species' fire rating safe to state publicly?
 *
 * `ignSrc: "est"` means the 0-10 value was inferred from the FS 6.305 criteria,
 * not published for that species. Every one of the twelve estimates since checked
 * against a published source was revised DOWNWARD, and all twelve lost the
 * clearance to sit within 30 ft of a structure. Publishing the remaining ones as
 * safe-at-the-house would repeat a claim with a 0-for-12 record.
 */
export const hasPublishedIgn = (p) => PUBLISHED_IGN_SOURCES.has(p.ignSrc);

/**
 * Is this species' cultural note safe to publish?
 *
 * `cultureSrc: "V"` is material that is widely repeated but not well sourced. The
 * database's CLAUDE.md is unambiguous: V "must never reach published output"
 * without a check against the Native American Ethnobotany Database
 * (naeb.brit.org). These describe living Ute practices; the rule is about respect
 * as much as accuracy.
 */
export const hasPublishableCulture = (p) => Boolean(p.culture) && p.cultureSrc !== 'V';

/** Human-readable label for where a published rating came from. */
export const ignSourceLabel = (ignSrc) =>
  ignSrc === 'CSU'
    ? 'CSU Extension FS 6.305 (rev. 7/2025)'
    : ignSrc === 'IDFW'
      ? 'Idaho Firewise master database'
      : null;

/**
 * Home Ignition Zone guidance for a PUBLISHED rating.
 *
 * The scale reads backwards from intuition: HIGHER means harder to ignite. This
 * project follows CSU, which permits 8, 9 and 10 within the first 30 ft. Idaho is
 * stricter; see docs/source-conflicts.md in the database repo. Do not "fix" this
 * to match Idaho.
 *
 * Returns null for an unpublished rating — callers must render the unrated state
 * rather than guess a zone.
 */
export function hizGuidance(p) {
  if (!hasPublishedIgn(p)) return null;
  const ign = p.ign;
  if (ign >= 8) return { key: 'z12', label: 'Suitable in Home Ignition Zones 1–2 (within 30 ft)' };
  if (ign >= 5) return { key: 'z3', label: 'Home Ignition Zone 3 only (beyond 30 ft)' };
  return { key: 'avoid', label: 'Not recommended near structures' };
}

/** URL slug for a species. Botanical name: stable, unique, and the better search target. */
export const speciesSlug = (p) =>
  p.sci
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Apply the gate to a plant record.
 *
 * Withheld fields are set to null AND accompanied by an explicit `*Withheld` flag,
 * so a template renders "not established" rather than silently showing a blank —
 * or worse, letting a null fall through arithmetic into a wrong answer. The
 * database's own UI did exactly that: its hiz() mapped a null rating to
 * "Avoid near structures", turning missing data into a fabricated warning.
 *
 * IDEMPOTENT: gating an already-gated record must be a no-op. The flags are
 * therefore carried forward rather than recomputed, because the evidence they were
 * derived from is gone by then — `culture` is already null, so recomputing
 * `Boolean(p.culture) && !cultureOk` yields false and the record silently forgets
 * that anything was withheld. The site's data is gated once at sync time, so a
 * second pass should never happen; this makes it harmless if one ever does.
 */
export function gatePlant(p) {
  const ignOk = hasPublishedIgn(p);
  const cultureOk = hasPublishableCulture(p);
  return {
    ...p,
    ign: ignOk ? p.ign : null,
    ignSrc: ignOk ? p.ignSrc : null,
    ignWithheld: p.ignWithheld ?? !ignOk,
    culture: cultureOk ? p.culture : null,
    cultureSrc: cultureOk ? p.cultureSrc : null,
    cultureWithheld: p.cultureWithheld ?? (Boolean(p.culture) && !cultureOk),
    slug: p.slug ?? speciesSlug(p),
  };
}

export const gateAll = (plants) => plants.map(gatePlant);

/**
 * Withheld-field tallies. Used by the build to assert the gate is idempotent —
 * gating twice must produce identical counts.
 */
export const withheldCounts = (plants) => ({
  ign: plants.filter((p) => p.ignWithheld).length,
  culture: plants.filter((p) => p.cultureWithheld).length,
});
