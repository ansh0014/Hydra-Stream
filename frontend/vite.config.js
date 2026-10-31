import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const CONTROLLER_URL = process.env.CONTROLLER_URL || 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: CONTROLLER_URL,
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: CONTROLLER_URL,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
