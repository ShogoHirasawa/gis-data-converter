# WASMファイル更新手順

テストコンソールログを削除したWASMファイルをローカル環境で生成する必要があります。

## 手順

### 1. WASMをリビルド
```bash
npm run build:wasm
```

または

```bash
./scripts/build-wasm.sh
```

### 2. 開発サーバーを再起動
```bash
# 現在実行中のサーバーを停止 (Ctrl+C)
npm run dev
```

### 3. ブラウザでハードリフレッシュ
- **Windows/Linux**: `Ctrl + Shift + R`
- **Mac**: `Cmd + Shift + R`

### 4. 確認
ブラウザの開発者ツール (F12) → Console タブでベクタータイル変換を実行し、以下のログが**表示されないこと**を確認：
- `[Rust] Parsed ... features`
- `[Rust] Zoom ...`
- `[Rust] Feature ...`

## 削除されたログ一覧

以下のRustファイルからデバッグログを削除しました：
- `wasm-core/src/lib.rs` - 4箇所の`debug_log`
- `wasm-core/src/wasm_api.rs` - 4箇所の`debug_log` + log関数定義
- `wasm-core/src/tiler.rs` - 3箇所の`debug_log`
- `wasm-core/src/mvt_encoder.rs` - 7箇所の`debug_log`
- `wasm-core/src/pmtiles_encoder.rs` - 5箇所の`debug_log`
- `wasm-core/src/geojson_parser.rs` - 1箇所の`eprintln!`

## トラブルシューティング

### まだログが表示される場合

1. **キャッシュをクリア**
   - Chrome: `Ctrl/Cmd + Shift + Delete` → 「キャッシュされた画像とファイル」を削除
   - Firefox: `Ctrl/Cmd + Shift + Delete` → 「キャッシュ」を削除

2. **開発者ツールでキャッシュ無効化**
   - F12 → Network タブ → "Disable cache" にチェック
   - ページをリロード

3. **WASMファイルが更新されているか確認**
   ```bash
   ls -lh src/wasm/vector_tile_core_bg.wasm
   ```
   タイムスタンプが最新であることを確認

4. **ビルドログを確認**
   ```bash
   npm run build:wasm
   ```
   エラーなく完了することを確認
