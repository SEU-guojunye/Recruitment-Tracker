import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import { fileURLToPath } from 'node:url'
import manifest from './manifest.config.js'

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest })
  ],
  build: {
    modulePreload: false,
    rollupOptions: {
      input: {
        offscreen: fileURLToPath(new URL('./offscreen.html', import.meta.url)),
      },
    },
  },
  server: {
    cors: {
      origin: [
        /chrome-extension:\/\//
      ]
    }
  }
})
