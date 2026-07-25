import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(dir, '../shared'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Socket.IO traffic goes to the game server during development.
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      '/healthz': 'http://localhost:3001',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
