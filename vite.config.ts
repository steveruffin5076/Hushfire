import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Hushfire/' : '/',
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: false
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
