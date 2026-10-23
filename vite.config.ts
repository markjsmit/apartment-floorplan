import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { housePlugin } from './tools/vite-plugin-house';

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the site under /<repo>/
  base: command === 'build' || isPreview ? '/apartment-floorplan/' : '/',
  plugins: [react(), housePlugin()],
  server: { port: 5180, strictPort: true },
  preview: { port: 5190, strictPort: true },
  build: { chunkSizeWarningLimit: 2000 },
}));
