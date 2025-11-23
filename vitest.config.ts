import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import path from 'path';

export default defineConfig({
  plugins: [react(), wasm()],
  test: {
    environment: 'happy-dom', // MapLibre GL JS用のDOM環境
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000, // 30秒タイムアウト（変換処理に時間がかかる場合があるため）
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/e2e/**', // E2EテストはPlaywrightで実行するため除外
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.wasm'], // WASMファイルをアセットとして扱う
  worker: {
    format: 'es',
    plugins: () => [wasm()], // WorkerでもWASMプラグインを使用
  },
});

