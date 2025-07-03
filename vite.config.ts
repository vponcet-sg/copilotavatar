import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Ensure assets are properly handled for production
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          azure: ['@azure/identity', 'microsoft-cognitiveservices-speech-sdk']
        }
      }
    }
  },
  server: {
    port: 3000,
    host: true
  }
})
