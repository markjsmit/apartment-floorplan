import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/apartment-floorplan/' : '/',
  plugins: [react()],
  server: { port: 5180, strictPort: true },
}));
