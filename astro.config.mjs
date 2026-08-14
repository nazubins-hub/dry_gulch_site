import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

export default defineConfig({
  // Live domain, served by Cloudflare Pages. Used for canonical URLs and for any
  // absolute URL generation (a sitemap, if one is ever added).
  site: 'https://nextsteppe.garden',
  integrations: [react()],
});