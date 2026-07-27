import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

export default defineConfig({
  devToolbar: { enabled: false },
  output: 'static',
  adapter: vercel(),
  security: { checkOrigin: false },
  vite: { plugins: [tailwindcss()] },
});
