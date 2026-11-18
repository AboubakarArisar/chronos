import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import fs from 'node:fs';

const page = n => resolve(import.meta.dirname, n);
// Proof numbers on the landing page come from the real data counts (written by tools/prepare-data.mjs).
function proofNumbers() {
  return {
    name: 'chronos-proof-numbers',
    transformIndexHtml(html) {
      let meta = {}; try { meta = JSON.parse(fs.readFileSync(page('public/d/meta.json'), 'utf8')); } catch { /* prepare-data has not run */ }
      return html.replace(/\{\{(maps|events|regions|skins)\}\}/g, (_, k) => meta[k] !== undefined ? Number(meta[k]).toLocaleString('en-US') : `{{${k}}}`);
    }
  };
}
export default defineConfig({
  base: './',
  plugins: [proofNumbers()],
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
