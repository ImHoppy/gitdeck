import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const gitd = 'http://127.0.0.1:7777'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // its "browser" build decodes entities through the DOM, which the markdown worker doesn't have
      'decode-named-character-reference': fileURLToPath(new URL('./node_modules/decode-named-character-reference/index.js', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/ws': { target: gitd, ws: true },
      '/login': gitd,
    },
  },
})
