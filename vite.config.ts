import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), wasm()],
  base: '/gis-data-converter/',
  worker: {
    format: 'es',
    plugins: () => [wasm()], // WorkerでもWASMプラグインを使用
  },
})

