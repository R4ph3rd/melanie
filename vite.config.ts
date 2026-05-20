import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// When deploying to GitHub Pages under https://<user>.github.io/<repo>/, set
// VITE_BASE=/<repo>/ in the build env so all asset URLs are prefixed correctly.
// In local dev (npm run dev) VITE_BASE is unset, so base stays at "/".
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  optimizeDeps: {
    exclude: ['@anthropic-ai/sdk'],
  },
})
