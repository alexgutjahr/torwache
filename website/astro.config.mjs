// @ts-check
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://torwache.com',
  output: 'static',
  integrations: [sitemap()],
  build: {
    format: 'directory',
  },
});
