# GIS Data Converter

GISデータをWebで変換するツールのUI実装です。

## 技術スタック

- **React 18** - UIライブラリ
- **TypeScript** - 型安全性
- **Vite** - ビルドツール
- **Tailwind CSS** - スタイリング
- **Iconify** - アイコン

## セットアップ

### 依存関係のインストール

```bash
npm install
```

### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開いてください。

### ビルド

```bash
npm run build
```

ビルドされたファイルは `dist` ディレクトリに出力されます。

## プロジェクト構造

```
src/
├── components/          # Reactコンポーネント
│   ├── Header.tsx      # ヘッダー（言語選択含む）
│   ├── Footer.tsx      # フッター
│   ├── MainContent.tsx # メインコンテンツ（状態管理）
│   └── states/         # 各状態のコンポーネント
│       ├── UploadState.tsx
│       ├── FormatDetectionState.tsx
│       ├── ConvertingState.tsx
│       ├── CompletedState.tsx
│       ├── ErrorState.tsx
│       └── UploadErrorState.tsx
├── i18n/               # 多言語対応
│   ├── translations.ts # 翻訳データ
│   └── LanguageContext.tsx # 言語コンテキスト
├── types/              # TypeScript型定義
│   └── index.ts
├── App.tsx             # メインアプリケーション
├── main.tsx            # エントリーポイント
└── index.css           # グローバルスタイル
```

## 機能

### 実装済み

- ✅ 5つの状態管理（Upload, Format Detection, Converting, Completed, Error）
- ✅ ファイルアップロード（ドラッグ&ドロップ対応）
- ✅ 多言語対応（25言語、主要4言語は完全実装）
- ✅ レスポンシブデザイン（Desktop, Tablet, Mobile）
- ✅ Soft Materialスタイルの実装
- ✅ プログレスバーアニメーション
- ✅ 言語選択とローカルストレージへの保存

### 未実装（今後の実装予定）

- ⏳ 実際のGISファイル変換機能
- ⏳ ファイル形式の詳細な自動判定
- ⏳ エラーハンドリングの強化
- ⏳ アクセシビリティの完全対応（ARIAラベルなど）

## デザイン

このプロジェクトは **Soft Material** スタイルガイドに基づいて設計されています：

- プライマリカラー: `#7FAD6F` (ナチュラルグリーン)
- 大きなボーダーラディウス: 32px
- 柔らかいシャドウ
- 親しみやすいデザイン

詳細は `design/paraflow/Style Guide/Soft Material.style-guide.md` を参照してください。

## ブラウザサポート

- Chrome (最新版)
- Firefox (最新版)
- Safari (最新版)
- Edge (最新版)

## ライセンス

LICENSE ファイルを参照してください。

