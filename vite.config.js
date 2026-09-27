import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import chesscomHandler from './api/chesscom/[kind]/[id].js';

// In local development, serve the same /api/chesscom route the Vercel function serves.
function devApi() {
  return {
    name: 'dev-chesscom-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api/chesscom/')) return chesscomHandler(req, res);
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  build: { target: 'es2020' },
});
