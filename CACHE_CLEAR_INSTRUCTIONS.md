# ブラウザキャッシュのクリア手順

## 1. 開発サーバーを再起動
```bash
# 現在のサーバーを停止 (Ctrl+C)
# 再起動
npm run dev
```

## 2. ブラウザでハードリフレッシュ

### Chrome / Edge
- **Windows/Linux**: `Ctrl + Shift + R` または `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

### Firefox
- **Windows/Linux**: `Ctrl + Shift + R` または `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

### Safari
- **Mac**: `Cmd + Option + R`

## 3. 開発者ツールでネットワークキャッシュを無効化

1. 開発者ツールを開く (F12)
2. "Network" / "ネットワーク" タブを開く
3. "Disable cache" / "キャッシュを無効にする" にチェック
4. 開発者ツールを開いたままページをリロード

## 4. 完全なキャッシュクリア（上記で解決しない場合）

### Chrome / Edge
1. `Ctrl/Cmd + Shift + Delete`
2. 「キャッシュされた画像とファイル」を選択
3. 「データを削除」

### Firefox
1. `Ctrl/Cmd + Shift + Delete`
2. 「キャッシュ」を選択
3. 「今すぐ消去」

## 確認方法

開発者ツール (F12) → Console タブを開いて、ベクタータイル変換を実行してください。
以下のようなログが**表示されなければ成功**です：
- `[Rust] Parsed ... features`
- `[Rust] Zoom ...`
- `[Rust] Feature ...`
- その他のRustデバッグメッセージ
