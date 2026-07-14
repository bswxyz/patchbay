import { defineConfig } from 'vite';

export default defineConfig({
  base: '/patchbay/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
});
