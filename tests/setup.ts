/**
 * Test setup file
 * Global test configuration and mocks
 */

import { beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// WebWorkerのモック設定（必要に応じて）
beforeAll(() => {
  // MapLibre GL JS用のグローバル設定
  // happy-dom環境でMapLibre GL JSが動作するように設定
  
  // WASMファイルの読み込みをモック（テスト環境用）
  // 実際のWASMファイルを読み込んで、fetchをモック
  if (typeof window !== 'undefined') {
    const originalFetch = window.fetch;
    
    // happy-dom環境ではWebAssembly.instantiateStreamingが正しく動作しないため、
    // WebAssembly.instantiateStreamingを無効化して、常にWebAssembly.instantiateを使用する
    if (typeof WebAssembly !== 'undefined' && WebAssembly.instantiateStreaming) {
      const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
      // @ts-ignore
      WebAssembly.instantiateStreaming = async function(source: any, importObject?: any) {
        // happy-dom環境ではinstantiateStreamingが動作しないため、
        // ResponseからArrayBufferを取得してinstantiateを使用
        if (source instanceof Response) {
          const bytes = await source.arrayBuffer();
          return await WebAssembly.instantiate(bytes, importObject);
        }
        // それ以外の場合は元の関数を使用
        return await originalInstantiateStreaming.call(this, source, importObject);
      };
    }
    
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' 
        ? input 
        : input instanceof URL 
        ? input.href 
        : input instanceof Request
        ? input.url
        : String(input);
      
      // WASMファイルのリクエストをインターセプト
      if (url.includes('vector_tile_core_bg.wasm')) {
        try {
          // ファイルシステムから直接読み込む
          const wasmPath = join(__dirname, '../src/wasm/vector_tile_core_bg.wasm');
          const wasmBuffer = readFileSync(wasmPath);
          
          // ArrayBufferに変換
          const arrayBuffer = wasmBuffer.buffer.slice(
            wasmBuffer.byteOffset,
            wasmBuffer.byteOffset + wasmBuffer.byteLength
          );
          
          // Responseを返す（WASMモジュールが期待する形式）
          // WebAssembly.instantiateStreamingが無効化されているため、
          // __wbg_load関数は自動的にWebAssembly.instantiateを使用する
          const response = new Response(arrayBuffer, {
            status: 200,
            statusText: 'OK',
            headers: { 
              'Content-Type': 'application/wasm',
              'Content-Length': arrayBuffer.byteLength.toString(),
            },
          });
          
          return response;
        } catch (error) {
          // フォールバック: 元のfetchを使用
          return originalFetch(input as RequestInfo, init);
        }
      }
      
      // その他のリクエストは元のfetchを使用
      return originalFetch(input as RequestInfo, init);
    };
  }
});

