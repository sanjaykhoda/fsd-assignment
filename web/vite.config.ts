import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Kept in step with the API's own PORT default. Override both together if
// something else on the machine already owns 4000:
//   PORT=4100 API_PORT=4100 npm run dev
const API_PORT = process.env.API_PORT ?? process.env.PORT ?? '4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Proxying /api keeps the browser on a single origin in development, which
    // is why there is no CORS middleware anywhere in this project. In
    // production the API serves this build directly, so it is same-origin too.
    proxy: {
      '/api': { target: `http://localhost:${API_PORT}`, changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
