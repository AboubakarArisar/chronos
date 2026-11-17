import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const page = n => resolve(import.meta.dirname, n);
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    assetsDir: 'app', // public/assets holds the prepared art, music and textures
    chunkSizeWarningLimit: 1200,
    rollupOptions: { input: { index: page('index.html'), app: page('app.html'), credits: page('credits.html'), privacy: page('privacy.html'), notfound: page('404.html') } }
  },
  worker: { format: 'es' },
  server: { port: +process.env.PORT || 5183, strictPort: true },
  preview: { port: +process.env.PORT || 4183, strictPort: true }
});
