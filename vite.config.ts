import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base is the repo path for GitHub Pages; override with BASE_PATH in CI.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/anatomi-qris/',
  plugins: [react()],
  build: {
    target: 'es2022',
    cssCodeSplit: false,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
