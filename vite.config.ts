import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@server': fileURLToPath(new URL('./server/src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Проксі тримає API на тому ж origin — сесійна cookie працює без CORS.
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
})
