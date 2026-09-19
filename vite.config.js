import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700, // three.js ships in its own lazily-loaded chunk
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html') },
    },
  },
  server: { host: true },
});
