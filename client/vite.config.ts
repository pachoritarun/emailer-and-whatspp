import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/Communication/',
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/Communication/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/Communication/, '')
      },
      '/Communication/webhook': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/Communication/, '')
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      },
      '/webhook': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
});
