/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Libraries that change rarely get their own chunks, so an app release doesn't re-download them. */
const VENDOR_CHUNKS: [chunk: string, packages: RegExp][] = [
  ['vendor-react', /\/node_modules\/(react|react-dom|scheduler)\//],
  ['vendor-router', /\/node_modules\/(react-router|react-router-dom)\//],
  ['vendor-radix', /\/node_modules\/@radix-ui\//],
  ['vendor-query', /\/node_modules\/@tanstack\//],
  ['vendor-zustand', /\/node_modules\/(zustand|use-sync-external-store)\//],
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // scripts/check-bundle-size.mjs reads the manifest to find each page's chunks
    manifest: true,
    rollupOptions: {
      input: {
        main: 'index.html',
      },
      output: {
        manualChunks(id) {
          const path = id.replace(/\\/g, '/')
          return VENDOR_CHUNKS.find(([, packages]) => packages.test(path))?.[0]
        },
      },
    },
  },
  test: {
    projects: [
      {
        // pure logic: stores, protocol, services. A .ts test that needs a DOM opts in per file with
        // `// @vitest-environment happy-dom`.
        extends: true,
        test: {
          name: 'node',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        // React components and hooks, rendered with @testing-library/react in happy-dom
        extends: true,
        test: {
          name: 'dom',
          include: ['src/**/*.test.tsx'],
          environment: 'happy-dom',
          setupFiles: ['src/test/setupDom.ts'],
        },
      },
    ],
  },
})
