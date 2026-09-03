import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 1000,
    proxy: {
      '/api': {
        target: 'http://localhost:1001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@vladmandic/face-api')) return 'vendor-face-api';
          if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-leaflet';
          if (id.includes('recharts')) return 'vendor-recharts';
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          if (id.includes('lucide-react') || id.includes('react-icons')) return 'vendor-icons';
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  esbuild: {
    supported: {
      destructuring: true,
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      supported: {
        destructuring: true,
      },
    },
  },
});
