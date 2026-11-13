import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // GitHub Pages 部署在 /interview-bridge/ 子路径下
  base: command === 'build' ? '/interview-bridge/' : '/',
  server: {
    port: 5178,
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
}))
