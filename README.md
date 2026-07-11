# Dry Gulch Design — site

Blog/portfolio site built with [Astro](https://astro.build), static output, ready for Cloudflare Pages.

Rename the business/wordmark throughout (search for "Dry Gulch Design") once you've settled on a name.

## Local dev

```bash
npm install
npm run dev
```

Site runs at `http://localhost:4321`.

## Content

- Blog posts: `src/content/blog/*.md`
- Portfolio projects: `src/content/portfolio/*.md`

Add a new file to either folder, matching the frontmatter fields of the existing examples. It shows up automatically — no other code changes needed. Set `draft: true` on any entry you're not ready to publish.

The current portfolio and blog entries are **placeholder content** — replace the text, and swap in real project photos, before this goes live.

## Contact form

`src/pages/contact.astro` posts to Formspree. Create a free form at formspree.io and replace `YOUR_FORM_ID` in that file with your real form ID. Until then, the form won't actually send anywhere.

## Deploying (GitHub → Cloudflare Pages)

1. Push this folder to a new GitHub repo.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, select the repo.
3. Build settings:
   - Framework preset: `Astro`
   - Build command: `npm run build`
   - Output directory: `dist`
4. Deploy. Cloudflare gives you a `*.pages.dev` URL immediately.
5. In the Pages project → **Custom domains**, add your domain. Since your DNS is already on Cloudflare, it creates the record automatically.

Every push to the connected branch redeploys the site.
