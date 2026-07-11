import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'client',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 6350,
    proxy: {
      '/api': 'http://localhost:5350',
      '/r': 'http://localhost:5350',
      '/convert': 'http://localhost:5350',
      '/track.js': 'http://localhost:5350',
      '/assets': 'http://localhost:5350'
    }
  }
});
