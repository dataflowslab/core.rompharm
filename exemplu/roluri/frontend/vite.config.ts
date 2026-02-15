import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/web/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Ensure modules can resolve dependencies from src/frontend/node_modules
    dedupe: ['react', 'react-dom', '@mantine/core', '@mantine/hooks', '@mantine/notifications', '@mantine/dates', '@mantine/dropzone', '@tabler/icons-react', 'react-i18next'],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    commonjsOptions: {
      include: [/node_modules/, /modules/],
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@mantine/core', '@mantine/hooks', '@mantine/notifications', '@mantine/dates', '@mantine/dropzone', 'dayjs'],
  },
});
