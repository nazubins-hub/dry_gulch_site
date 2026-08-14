import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// Update `site` to your live domain once it's connected in Cloudflare Pages.
export default defineConfig({
  site: 'https://example.com',
  integrations: [react()],
});