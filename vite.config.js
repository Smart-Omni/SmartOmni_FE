import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1'
  const localGateway = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(target).hostname)
  const proxy = { '/api': { target, changeOrigin: !localGateway } }
  const allowedHosts = ['.lvh.me', '.smartomni.local']
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { proxy, allowedHosts },
    preview: { proxy, allowedHosts },
  }
})
