import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // Using relative paths so it works on any sub-path (like GitHub Pages)
  build: {
    outDir: 'dist',
  },
})
