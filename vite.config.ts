import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  // GitHub Pages 部署在子路径下，Vercel 在根路径；由部署脚本注入
  base: process.env.PAGES_BASE ?? '/',
  server: {
    port: 5178,
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
}))
