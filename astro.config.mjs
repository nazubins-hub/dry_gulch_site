import { defineConfig } from 'astro/config';

import cloudflare from "@astrojs/cloudflare";

// Update `site` to your live domain once it's connected in Cloudflare Pages.
export default defineConfig({
  site: 'https://example.com',
  output: "hybrid",
  adapter: cloudflare()
});