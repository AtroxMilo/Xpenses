import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // In dev the Worker (auth + backup API) runs separately via `npm run dev:api`.
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // Never let the service worker cache or SPA-rewrite the backup API.
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'Xpenses',
        short_name: 'Xpenses',
        description: 'Track your expenses by week or month and see where your money goes.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
