import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Custom plugin to replace UTF-8 checkmarks with ASCII in console output
function asciiOutputPlugin() {
  // Intercept console output globally
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = (chunk: any, ...args: any[]) => {
    if (typeof chunk === 'string') {
      chunk = chunk
        .replace(/✓/g, '[OK]')
        .replace(/✔/g, '[OK]')
        .replace(/✗/g, '[ERROR]')
        .replace(/✖/g, '[ERROR]')
        .replace(/⚠/g, '[WARN]')
        .replace(/ℹ/g, '[INFO]');
    }
    return originalStdoutWrite(chunk, ...args);
  };

  process.stderr.write = (chunk: any, ...args: any[]) => {
    if (typeof chunk === 'string') {
      chunk = chunk
        .replace(/✓/g, '[OK]')
        .replace(/✔/g, '[OK]')
        .replace(/✗/g, '[ERROR]')
        .replace(/✖/g, '[ERROR]')
        .replace(/⚠/g, '[WARN]')
        .replace(/ℹ/g, '[INFO]');
    }
    return originalStderrWrite(chunk, ...args);
  };

  return {
    name: 'ascii-output',
    // This runs for both dev and build
    config() {
      return {};
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), asciiOutputPlugin()],
  base: '/web/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      'react-router-dom': path.resolve(__dirname, './node_modules/react-router-dom'),
      '@mantine/core': path.resolve(__dirname, './node_modules/@mantine/core'),
      '@mantine/hooks': path.resolve(__dirname, './node_modules/@mantine/hooks'),
      '@mantine/dates': path.resolve(__dirname, './node_modules/@mantine/dates'),
      '@mantine/notifications': path.resolve(__dirname, './node_modules/@mantine/notifications'),
      '@mantine/modals': path.resolve(__dirname, './node_modules/@mantine/modals'),
      '@tabler/icons-react': path.resolve(__dirname, './node_modules/@tabler/icons-react'),
    },
    preserveSymlinks: false,
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
    include: ['react', 'react-dom', '@mantine/core', '@mantine/hooks'],
  },
});
