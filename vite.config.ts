import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { housePlugin } from './tools/vite-plugin-house';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/apartment-floorplan/' : '/',
  plugins: [react(), housePlugin()],
  server: { port: 5180, strictPort: true },
}));
