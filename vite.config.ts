import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

export default defineConfig({
  plugins: [react(), {
    name: 'extension-assets',
    apply: 'build',
    generateBundle() {
      // Keep promotional/SEO assets in the repository, outside the extension.
      for (const fileName of ['manifest.json', 'icons/icon-16.png', 'icons/icon-48.png', 'icons/icon-128.png']) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(new URL(`./public/${fileName}`, import.meta.url)) })
      }
    },
  }],
  base: './',
  build: {
    copyPublicDir: false,
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  test: {
    // Chrome APIs are mocked; component markup is verified through SSR.
    environment: 'node',
  },
})
