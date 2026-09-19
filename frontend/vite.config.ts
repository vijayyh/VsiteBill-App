import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true, type: 'module' },
      // The API calls themselves are handled by the offline upload queue (see
      // src/lib/offlineQueue.ts), not by service-worker caching — this config's
      // job is only to make the app SHELL (HTML/JS/CSS) load with zero network,
      // so the app can still open and let a supervisor queue a photo at a site
      // with no signal at all.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/uploads/'),
            handler: 'CacheFirst',
            options: { cacheName: 'delivery-photos', expiration: { maxEntries: 200 } },
          },
        ],
      },
      manifest: {
        name: 'SiteVerify',
        short_name: 'SiteVerify',
        description: 'Delivery challan reconciliation for KH & Sustaniq',
        theme_color: '#1A3C5E',
        background_color: '#F5F5F2',
        display: 'standalone',
        start_url: '/login',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})
