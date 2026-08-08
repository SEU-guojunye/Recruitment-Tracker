import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/unit/**/*.{test,spec}.{js,jsx}', 'packages/**/*.{test,spec}.{js,jsx}'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
