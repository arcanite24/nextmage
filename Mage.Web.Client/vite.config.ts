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
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
