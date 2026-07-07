import { defineConfig } from 'vite'

// Separate config for the service worker: bundled as a standalone IIFE
// (no ES imports) so it stays a plain classic script, exactly like the
// original hand-written public/background.js — just generated from the
// same TypeScript sources as the side panel instead of duplicating them.
// Entry path is relative to the project root (where `npm run build` runs),
// same convention Vite uses for `build.outDir` above — keeps this file
// dependency-free (no @types/node needed for `__dirname`).
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/background.ts',
      name: 'ElOrganizadorBackground',
      formats: ['iife'],
      fileName: () => 'background.js',
    },
  },
})
