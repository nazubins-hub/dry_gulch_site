// What a photograph may say in public, and what may not leave with it.
//
// The companion to publish-gate.js. That one decides which species FACTS are safe
// to state; this one decides which IMAGES are safe to publish and how they must be
// credited. Both are the site's rules rather than the database's, for the same
// reason: this repo is the thing that goes on the internet, so the decision about
// what the internet sees belongs here, next to the templates that render it.
//
// The database applies its own allowlist before anything crosses (see
// PUBLIC_IMAGE_FIELDS in its scripts/build.py). This module is the second wall.
// Neither is redundant: the first controls what leaves a private repo, the second
// controls what a public one will render. A photograph has to clear both.

import { speciesSlug } from './publish-gate.js';

/**
 * Licences a commercial landscape business may actually publish under.
 *
 * The trap is NC. A large share of iNaturalist and Flickr content is CC-BY-NC,
 * which feels free and is not — Next Steppe is a commercial use. NC, ND and ARR
 * are absent from this set, and their absence IS the refusal: a licence nobody
 * listed here cannot publish, so a licence string invented tomorrow fails closed.
 */
export const PUBLISHABLE_LICENSES = new Set([
  'CC0',
  'CC-BY',
  'CC-BY-SA',
  'PD-US',
  'own',
  'licensed',
]);

/** Licences that oblige a visible credit line wherever the image appears. */
export const ATTRIBUTION_LICENSES = new Set(['CC-BY', 'CC-BY-SA']);

/**
 * Fields that must never reach this repo.
 *
 * `lat`/`lon` are the coordinates a photograph was taken at. On a job that is the
 * client's address, and this repo is public and permanent. They stay in the
 * database's manifest.json and in its out/field-log.geojson, which the office uses
 * and which is never synced.
 *
 * `notes` carries the field caption and the species-matcher's proposals — working
 * material, and on the existing capture it names where the photo was taken.
 * `file` is the path to the untouched original, which holds full EXIF and is never
 * published; only the stripped derivatives are.
 */
export const PRIVATE_FIELDS = ['lat', 'lon', 'notes', 'file'];

/**
 * Refuse an image record that carries a private field.
 *
 * Throws rather than filtering. Silently dropping `lat` would let a broken export
 * upstream go unnoticed for as long as nobody looked at the JSON; failing the sync
 * makes the fix immediate. This is the check that a client's address depends on.
 */
export function assertNoPrivateFields(img) {
  const found = PRIVATE_FIELDS.filter((f) => f in img);
  if (found.length) {
    throw new Error(
      `image ${img.id}: private field(s) ${found.join(', ')} in the projection. ` +
        'These must never reach this repo — check PUBLIC_IMAGE_FIELDS in the ' +
        "database's scripts/build.py.",
    );
  }
}

/**
 * Why this image may not be published, or null if it may.
 *
 * Every rule here is also enforced at ingest in the database. That is deliberate.
 * The database blocks a bad image from being FILED; this blocks one from being
 * RENDERED, and it sits beside the template that would render it — so a record
 * that was filed before a rule existed, or edited afterwards, is still caught at
 * the point where publishing actually happens.
 */
export function imageRefusal(img) {
  if (!PUBLISHABLE_LICENSES.has(img.license)) {
    return `licence "${img.license ?? 'none'}" is not publishable for commercial use`;
  }
  if (ATTRIBUTION_LICENSES.has(img.license) && !img.credit) {
    return `licence ${img.license} requires a credit line and none is recorded`;
  }
  if (img.idVerification === 'unverified') {
    return 'identification unverified — a wrong photo under your name is worse than no photo';
  }
  if (!img.derivatives?.card && !img.derivatives?.thumb) {
    return 'no publishable derivative — only originals, which are never published';
  }
  return null;
}

/**
 * The credit line for one image, composed in exactly one place.
 *
 * Both the species page and the credits page render attribution, and hand-writing
 * it twice is how the two end up wording the same obligation differently. CC-BY
 * requires the credit to travel with the image; generating it from the record is
 * what keeps the page and the manifest saying the same thing.
 */
export function creditLine(img) {
  if (img.license === 'own') return '© Next Steppe';
  const who = img.credit || 'Unknown photographer';
  return img.license === 'licensed' ? `${who} — licensed` : `${who} · ${img.license}`;
}

/**
 * Split an image index into what publishes and what does not.
 *
 * Returns refusals rather than discarding them so the publish audit can show what
 * was held back and why. A gate that only reports its output makes an unnoticed
 * over-refusal indistinguishable from an empty library.
 */
export function gateImages(index) {
  const images = index?.images ?? [];
  const published = [];
  const refused = [];
  for (const img of images) {
    assertNoPrivateFields(img);
    const reason = imageRefusal(img);
    if (reason) refused.push({ id: img.id, sci: img.sci, reason });
    else published.push(img);
  }
  return { published, refused };
}

/** Role order for a gallery: the spec shot, then the ID shot, then the rest. */
export const ROLE_ORDER = ['habit', 'flower', 'foliage', 'seed', 'winter', 'bark', 'detail'];

/** Human labels for the roles, for the gallery captions. */
export const ROLE_LABEL = {
  habit: 'Whole plant',
  flower: 'Bloom',
  foliage: 'Foliage',
  seed: 'Seed head',
  winter: 'Winter form',
  bark: 'Bark',
  detail: 'Detail',
};

/**
 * Index published images by species slug, ready for a page to render.
 *
 * `primary` is the hero: the best habit shot if there is one, else the best
 * flower, else whatever exists. That ordering is the database's — habit is the
 * spec shot and flower is the ID shot, which is also the order a reader wants
 * them in.
 *
 * `gallery` holds one image per remaining role. Aspect variants are kept separate:
 * two photographs of the same species and role on different slopes are
 * complementary rather than competing, and flattening them into the role list
 * would make the second look like a duplicate of the first.
 */
export function imagesBySpecies(published) {
  const out = {};
  const best = (a, b) => b.tier - a.tier || a.id.localeCompare(b.id);

  for (const img of published) {
    const slug = speciesSlug({ sci: img.sci });
    (out[slug] ??= { primary: null, gallery: [], variants: [], byRole: {} });
    const bucket = out[slug];
    if (img.status === 'variant') bucket.variants.push(img);
    else (bucket.byRole[img.role] ??= []).push(img);
  }

  for (const bucket of Object.values(out)) {
    for (const role of Object.keys(bucket.byRole)) bucket.byRole[role].sort(best);
    bucket.variants.sort(best);

    const roles = ROLE_ORDER.filter((r) => bucket.byRole[r]?.length);
    const heroRole = roles[0] ?? null;
    bucket.primary = heroRole ? bucket.byRole[heroRole][0] : null;
    bucket.gallery = roles
      .flatMap((r) => bucket.byRole[r])
      .filter((img) => img !== bucket.primary);
  }
  return out;
}

/** Total published images, and how many are the owner's own work. */
export const imageCounts = (published) => ({
  total: published.length,
  own: published.filter((i) => i.license === 'own').length,
  borrowed: published.filter((i) => i.license !== 'own').length,
});
