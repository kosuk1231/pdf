import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // pdfjs worker is imported with ?url and served as a static asset.
  build: {
    target: 'es2020',
  },
})
