# Security notes

Reviewed 2026-08-13, before first publication.

This file exists mainly so the next `npm audit` doesn't cause a fire drill. The
audit is loud and mostly inapplicable, and the reasons are worth writing down once.

## Why `npm audit` reports high-severity findings that don't apply

`npm audit` reports 6 vulnerable packages (4 high) via 21 underlying advisories. The
large majority require **server-side rendering**, and this site has none.

What the site actually is:

- `output` is static (Astro's default) — **no adapter**
- **no middleware** (`src/middleware.*` does not exist)
- **no server islands** (`server:defer`), **no `define:vars`**, **no
  `transition:name/animate/persist`**, **no dynamic slot names**, **no spread props**
- **reads no request input at all** — zero uses of `Astro.request`, `Astro.url`,
  `Astro.params`, `Astro.cookies`, or `searchParams`

Cloudflare Pages serves pre-rendered files. No request reaches Astro at runtime, so
advisories about reflected XSS, header manipulation, middleware auth bypass, and
Host-header SSRF have nothing to act on.

Verify the claims above still hold:

```bash
grep -rnE 'Astro\.(request|url|params|cookies|redirect)|searchParams' src/   # expect none
grep -rnE 'server:defer|define:vars|transition:(name|animate|persist)' src/  # expect none
ls src/middleware.* 2>/dev/null                                              # expect none
grep -n 'adapter' astro.config.mjs                                           # expect none
```

### Per package

| Package | Why it doesn't reach visitors |
|---|---|
| `astro` | Advisories cover server islands, middleware, adapters, `/_image`, `define:vars`, spread props, view transitions, slot names — none used. The dev-server local-file-read is real but local. |
| `vite`, `esbuild` | **Dev-server only.** See hygiene note below. The `server.fs.deny` bypass is Windows-only. |
| `sharp` | libvips image decoding. The site has **0 images and 0 `<img>` tags**, so the code path never runs. |
| `js-yaml` | Quadratic CPU on `!!omap` while parsing **our own** markdown frontmatter at build time. Not attacker-controlled. |
| `@astrojs/react` | Pinned deliberately — see below. |

**Do not run `npm audit fix --force`.** It installs `astro@7`, a major upgrade from
4.16, and would undo the version pinning below. If Astro is upgraded, do it
deliberately and **re-do this review** — an adapter or middleware would change the
analysis completely.

## Version pinning

`@astrojs/react` is pinned to **v3** with **React 18**, because the site is on Astro
4. `astro add react` installs v6 + React 19, which builds successfully but **breaks
`astro dev`**: the integration shadows the `/plants` route and serves its own config
module instead of the page. Do not bump the integration without upgrading Astro.

## Dev-server hygiene — the one live risk

The `esbuild` and `vite` advisories let **any website you visit** send requests to
your local dev server and read the responses, while `npm run dev` is running.

- Don't leave the dev server running while browsing.
- Don't use `--host` on untrusted networks; the default binds localhost only.

## Headers and CSP

`dist/_headers` is **generated** by `scripts/build-headers.mjs` on every build
(`postbuild`). Don't hand-edit it.

The CSP's `script-src` carries a SHA-256 hash for each inline script. The build
currently has exactly **one** inline script (Astro's island bootstrap on `/plants`)
and **zero** external `src` scripts. The hash changes whenever that bootstrap
changes, which is why it is computed rather than hardcoded — a stale hash breaks
hydration silently.

Two deliberate compromises:

- **`style-src` requires `'unsafe-inline'` and this is not removable.** The plant
  browser is a React component built from inline style objects (~2,600 `style="…"`
  attributes) and Astro emits scoped `<style>` blocks per component. It is acceptable
  *here* only because the site renders no user input: every value comes from a
  build-time data file, and the single `dangerouslySetInnerHTML` is a static literal
  with no interpolation. Do not read this as "inline styles are fine".
- **No HSTS yet.** `Strict-Transport-Security` is a promise that the domain is always
  reachable over HTTPS, cached by browsers for its `max-age` regardless of whether
  that stays true. Add it once the real domain is wired up and confirmed.

To verify the CSP doesn't break anything after a change, serve `dist/` with the
headers applied (`astro preview` ignores `_headers`) and confirm the `/plants` island
hydrates with a clean console.

## Third-party requests: none

Fonts are self-hosted in `public/fonts` (see the README there for attribution and
licensing). Previously Fraunces/IBM Plex loaded from `fonts.googleapis.com` in
`global.css`, and the plant browser loaded Fraunces/Jost from there again — every
visitor's IP went to Google twice per page. Both are gone.

The component's own `@import` still exists upstream in the database repo's
`ui/template.jsx`, because its standalone view needs it. `scripts/build-island.mjs`
strips it while generating the island and **fails the build if it can't find it**, so
an upstream template change cannot silently reintroduce the request.

Check after any dependency or template change:

```bash
grep -rhao 'https\?://[a-zA-Z0-9.-]*' dist/ | sort -u
```

Expect only: `www.w3.org` (SVG namespace), `formspree.io` (form action),
`reactjs.org` (a comment in React's bundle), and `github.com` / `scripts.sil.org`
(text inside the font licence files). **No `fonts.googleapis.com`.**

## Contact form — inert until wired

`src/pages/contact.astro` still posts to `https://formspree.io/f/YOUR_FORM_ID`, which
does not exist. **Submissions currently fail**; a visitor gets a Formspree error
rather than reaching anyone. Before launch:

1. Create the form and replace `YOUR_FORM_ID`.
2. Enable Formspree's spam protection.
3. Add a short notice near the submit button saying where submissions go — the form
   collects name, email, location and free-text project details, and sends them to a
   third party.

`form-action https://formspree.io` in the CSP already allows the submission. Narrow
it if the form is ever removed or moved.

## Data published here

`data/plants.public.json` is a **gated projection** of the plant database, not a copy.
It deliberately omits unpublished (estimated) fire ratings and unverified cultural
notes, keeping only `ignWithheld` / `cultureWithheld` flags to record that something
was withheld. See `src/lib/publish-gate.js` and the README. The raw export is
gitignored so it cannot be committed by accident.

No secrets, `.env` files, or API keys are present or expected — the site is fully
static and calls no APIs.

## Accepted, not fixed

The initial commit carries the author email `nick@Nicholass-MacBook-Air.local`
(name plus machine hostname). Rewriting an already-pushed commit costs more than the
disclosure is worth. Consider setting a per-repo `user.email` for future commits.
