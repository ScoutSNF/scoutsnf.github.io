import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const base = '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'ScoutSNF — SNF Market Analysis',
        short_name: 'ScoutSNF',
        description: 'Radius-based competitive market analysis for skilled nursing facility acquisitions',
        theme_color: '#0f4c5c',
        background_color: '#0f4c5c',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Excluded from precache, and navigateFallback explicitly cleared (vite-plugin-pwa
        // defaults it to 'index.html' otherwise, which registers its own NavigationRoute bound to
        // the precache -- ahead of and instead of the NetworkFirst entry below). Without both of
        // these the app shell is served straight from precache for every navigation (effectively
        // cache-only), which could keep an already-installed visitor on a stale, pre-gate bundle
        // indefinitely instead of picking up a new deploy on their next load.
        globIgnores: ['index.html'],
        navigateFallback: undefined,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell',
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/(data\.cms\.gov|geocoding\.geo\.census\.gov|healthdata\.gov|tile\.openstreetmap\.org|.*\.tile\.openstreetmap\.org)\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'external-data-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      devOptions: { enabled: false }
    })
  ]
})
