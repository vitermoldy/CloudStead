import { defineConfig } from 'vite';

// The server (npm run server) keeps focus history and a copy of the save in MySQL; dev forwards /api to it.
const api = { '/api': { target: `http://localhost:${process.env.PORT ?? 8791}` } };

export default defineConfig({
  base: './',
  build: {
    assetsDir: 'build',
    chunkSizeWarningLimit: 900,
  },
});
