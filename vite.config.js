import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/auto-2048/' : '/',
  build: {
    outDir: 'dist',
  },
})
