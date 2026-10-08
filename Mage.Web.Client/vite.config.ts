/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // the new app, the legacy client (until every screen is replaced) and the visual test harness
      input: {
        main: 'index.html',
        legacy: 'legacy.html',
        visual: 'visual.html',
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
