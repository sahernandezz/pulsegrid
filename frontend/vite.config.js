import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' -> relative asset paths, so the built static site works under any
// subpath (GitHub Pages, S3, a portfolio subfolder, etc.) and at a root domain
// (Firebase Hosting) — the app has no client-side routing, so relative paths are safe.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy third-party libs into their own chunks so app-code changes
        // don't bust the (rarely-changing) vendor caches, and the initial payload
        // is smaller. Firebase serves /assets/** as immutable for a year.
        manualChunks: {
          react: ['react', 'react-dom'],
          recharts: ['recharts'],
          motion: ['framer-motion'],
          firebase: ['firebase/app', 'firebase/analytics'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
