import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const gitd = 'http://127.0.0.1:7777'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': { target: gitd, ws: true },
      '/login': gitd,
    },
  },
})
