import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isElectron = process.env.BUILD_TARGET === 'electron';
    const base = isElectron ? './' : '/Intal-pro/';
    return {
      base,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        !isElectron && VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
                handler: 'CacheFirst',
                options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60*60*24*365 } },
              },
              {
                urlPattern: /^https:\/\/(cdn|cdnjs)\..*\.(js|css)/i,
                handler: 'CacheFirst',
                options: { cacheName: 'cdn-cache', expiration: { maxEntries: 30, maxAgeSeconds: 60*60*24*30 } },
              },
            ],
          },
          manifest: {
            name: 'INTAL PRO - Sistemi i Faturimit',
            short_name: 'INTAL PRO',
            description: 'Sistem faturimi profesional me sinkronizim cloud',
            theme_color: '#D81B60',
            background_color: '#ffffff',
            display: 'standalone',
            orientation: 'portrait',
            start_url: base,
            scope: base,
            icons: [
              { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
              { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
            ],
          },
        }),
      ].filter(Boolean),
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
