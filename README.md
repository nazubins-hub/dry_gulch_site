# Next Steppe — site

Xeriscape plant reference and practice site for the Vail Valley, built with
[Astro](https://astro.build), static output, deployed on Cloudflare Pages.

## Local dev

```bash
npm install
npm run dev
```

Site runs at `http://localhost:4321`.

## The plant database

The 100-species database is **not authored here**. It lives in its own repo
(`xeric-plant-system`), wherever you keep it locally. Point `PLANT_DB_PATH` at that
checkout before syncing:

```bash
export PLANT_DB_PATH=/path/to/xeric-plant-system
```

That repo's governing rule is that every fact has exactly one home — `plants.json`.
Cloudflare Pages builds from GitHub and cannot reach it, so this repo has to carry
what the site needs. What it carries is **not a copy of the database**: it is
`data/plants.public.json`, the *gated projection* of it.

The raw export is never written to disk here. `sync:plants` reads the database's
`plants.json`, passes it through `src/lib/publish-gate.js` in memory, and writes only
the result. **This repo is public**, and a verbatim copy would put all 41 estimated
fire ratings on GitHub as structured data — where `ign: 8` survives scraping and
reshaping considerably better than the `ignSrc: "est"` qualifier in the field beside
it. `data/plants.json` is gitignored so it cannot reappear by accident.

Withheld records keep `ignWithheld: true` / `cultureWithheld: true`. The public data
still says *something was deliberately withheld here* — it just never says what the
value was.

```bash
npm run sync:plants     # re-derive data/plants.public.json + the UI template
npm run check:plants    # fail if the data no longer matches source × gate
npm run audit:plants    # review what the database's rules flag before publishing
```

`check:plants` runs before every build and catches three kinds of drift:

| drift | detected | works on CI |
|---|---|---|
| the gated data was hand-edited here | `outputSha` mismatch | yes |
| the gate rule changed without a re-sync | `gateSha` mismatch | yes |
| the database moved on | re-derives and compares byte-for-byte | no — needs the source |

When the database repo is absent the third check is skipped and the build proceeds;
the first two still run. Point `PLANT_DB_PATH` at another checkout to sync elsewhere.

**Never edit `data/plants.public.json` or `src/components/XericPlantDB.template.jsx`
directly** — both are derived. Change the database, or the gate, then re-sync.

`audit:plants` reads the **database**, not the site data, and refuses to run without
it. It reports on exactly the fields the gate removes, so auditing the shipped file
would always return zero findings — a clean bill of health that means nothing.

## What is published, and what is withheld

`src/lib/publish-gate.js` is the single place that decides. Two rules, both keyed
on provenance fields rather than species names, so corrections in the database
publish automatically on the next sync:

- **Ignitability** renders only where `ignSrc` is `CSU` or `IDFW` — a published
  source. Estimated ratings (`ignSrc: "est"`) show *not established*. Of the twelve
  estimates since checked against a published source, all twelve were revised
  downward and all twelve lost their clearance to sit within 30 ft of a structure;
  the remaining estimates are not stated as safety facts.
- **Cultural notes** flagged `cultureSrc: "V"` are withheld pending a check against
  the Native American Ethnobotany Database (naeb.brit.org), per the database's own
  rule. The species still publishes; only the unverified note is held back.

Both the species pages and the interactive browser honor both rules.

The browser is built by `scripts/build-island.mjs`, which injects gated data into
the `/* __PLANTS__ */` placeholder in the synced UI template. That is why the
template is synced rather than the database's generated `out/xeric-plant-db.jsx` —
the generated file has the full dataset baked in, with no way to feed it gated
data. `build-island.mjs` refuses to emit if a withheld rating still carries a
value.

## Content

- Blog posts: `src/content/blog/*.md`
- Portfolio: **no routes, by design.** `src/pages/portfolio/` was removed because an
  empty "Built Work" page that told visitors to add files to `src/content/portfolio/`
  was publishing publicly. The collection schema is still defined in
  `src/content/config.ts`; to bring the section back, add entries under
  `src/content/portfolio/`, restore an index and `[...slug]` route, and re-add the
  nav link in `src/layouts/BaseLayout.astro`. Old note, kept for context: the three
  entries that shipped with the template were fabricated case studies and were
  removed. The collection and routes are intact so real projects can drop in.

Set `draft: true` on any entry not ready to publish.

## Contact form

`src/pages/contact.astro` posts to Formspree (form `mlgqrnzy`) via a hand-written
`fetch` — no SDK, no third-party script. It shows an inline thank-you without leaving
the page, and falls back to a native form POST if JavaScript is unavailable.

Both `connect-src` and `form-action` in the CSP must keep allowing `formspree.io` —
one covers each path. See SECURITY.md.

Formspree's free tier caps monthly submissions and **rejects** rather than queues over
the cap, so keep an eye on volume.

## Version pinning

`@astrojs/react` is pinned to **v3** with **React 18**, because this site is on
Astro 4. `astro add react` installs v6 + React 19, which builds but breaks
`astro dev`: the integration shadows the `/plants` route and serves its own config
module instead of the page. Do not upgrade the integration without upgrading Astro.

## Known gaps

- No plant images. The database's `manifest.json` is empty (0 of 100 species). Its
  rule against AI-generated plant imagery is absolute.
- 12 records mention a numeric rating in their `notes` prose, but all 12 are
  retraction notes on species *corrected* to a published value ("was ign 8
  (estimated)", now 6). None sit on a species whose rating is currently withheld, so
  they disclose a correction rather than an estimate. Left in deliberately.
- `astro.config.mjs` still has `site: 'https://example.com'` — set it to the real
  domain when DNS is wired up.

## Deploying (GitHub → Cloudflare Pages)

1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
2. Build settings: framework preset `Astro`, build command `npm run build`, output
   directory `dist`.

The synced database files are committed, so the Cloudflare build needs nothing from
the local machine.
