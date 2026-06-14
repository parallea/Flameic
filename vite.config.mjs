/** @type {import('vite').UserConfig} */
export default {
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 4028,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2021',
    outDir: 'dist',
  },
};
