import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Hushfire/' : '/',
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: false,
    // Vite >= 5.4.12 rejects any Host header that isn't localhost or a bare IP
    // (DNS-rebinding protection), which 403s this dev server when it's reached
    // through a proxy or by hostname from another device — e.g. the two-window
    // co-op test in docs/COOP_SESSION_GUIDE.md §6. It already binds 0.0.0.0 on
    // purpose, so accept any host by default and allow locking it down to an
    // explicit comma-separated list via VITE_ALLOWED_HOSTS. Dev-server only:
    // the Pages build is static and never runs this.
    allowedHosts: process.env.VITE_ALLOWED_HOSTS
      ? process.env.VITE_ALLOWED_HOSTS.split(',').map(h => h.trim())
      : true
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
