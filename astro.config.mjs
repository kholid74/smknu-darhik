import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

export default defineConfig({
  devToolbar: { enabled: false },
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  security: { checkOrigin: false },
  vite: { plugins: [tailwindcss()] },
});
