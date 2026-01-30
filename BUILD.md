# Web Tracker - ビルドガイド

MediaPipe を使った手と顔のトラッキングアプリケーション。Resonite / VRChat 向けに OSC でデータを送信します。

## 必要なもの

- Node.js (v18 以降推奨)
- pnpm (package.json で指定されているバージョン)

## 開発環境でのセットアップ

```bash
# 依存関係をインストール
pnpm install

# 開発サーバーを起動（Vite + Electron + Server）
pnpm start
```

## 配布用ビルド

### Windows 向けビルド

```bash
# ビルドを実行
pnpm run electron:build:win
```

ビルドが完了すると、`release` フォルダに以下のファイルが生成されます：

- **インストーラー版**: `Web Tracker Setup 1.0.0.exe` - インストールが必要
- **ポータブル版**: `Web Tracker-1.0.0-portable.exe` - インストール不要、どこでも実行可能

### ビルドの注意点

1. **初回ビルドは時間がかかります**（依存関係のダウンロードなど）
2. **アンチウイルスソフトの警告**が出る場合がありますが、これは署名されていない実行ファイルによる誤検出です
3. **アイコンをカスタマイズしたい場合**は、`build/icon.ico` を配置してください

## アプリの使い方

1. **アプリを起動**
2. **カメラを選択**（Control Panel から）
3. **Resonite のユーザー名とポートを入力**
4. **Setup FaceTrack ボタンをクリック**
5. トラッキング開始！

### OSC 設定

- デフォルトポート: `9000`
- 送信先: `127.0.0.1` (localhost)

### キャリブレーション

- **Head Calibrate**: 頭の位置をリセット
- **Hand Calibrate**: 手のサイズをキャリブレート（3秒のカウントダウン後）

## トラブルシューティング

### ビルドが失敗する

```bash
# node_modules をクリーンアップして再インストール
rm -rf node_modules
pnpm install
```

### OSC が送信されない

- Resonite / VRChat で OSC が有効になっているか確認
- ポート番号が正しいか確認（デフォルト: 9000）
- ファイアウォールで OSC ポートがブロックされていないか確認

### カメラが認識されない

- ブラウザがカメラへのアクセスを許可しているか確認
- 他のアプリケーションがカメラを使用していないか確認

## 技術スタック

- **Electron**: デスクトップアプリフレームワーク
- **React + Vite**: UI フレームワーク
- **MediaPipe**: 手と顔のトラッキング
- **Three.js**: 3D 可視化
- **node-osc**: OSC メッセージ送信
- **Express + WebSocket**: Resonite 連携サーバー

## ライセンス

このプロジェクトの配布やライセンスについては、開発者にお問い合わせください。
