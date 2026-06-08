import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' -> relative asset paths, so the built static site works under any
// subpath (GitHub Pages, S3, a portfolio subfolder, etc.).
export default defineConfig({
  base: './',
  plugins: [react()],
});
