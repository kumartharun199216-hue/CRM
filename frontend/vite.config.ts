/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig(async () => {
  const isTest = Boolean(process.env.VITEST);
  const plugins = [react()];
  if (!isTest) {
    try {
      const tailwindcss = (await import('@tailwindcss/vite')).default;
      plugins.push(tailwindcss());
    } catch {
      // In dev/prod with native support
    }
  }
  return {
    plugins,
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['e2e/**', 'node_modules/**'],
    },
  };
});
