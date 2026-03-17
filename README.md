# 買い物リスト | みっちー

GitHub Pages でそのまま公開できる、スマホ向けのシンプルな買い物リスト Web アプリです。  
HTML / CSS / JavaScript だけで動き、サーバーやビルドは不要です。

## アプリ概要

- 買い物項目を追加、完了、削除できます
- localStorage でブラウザに保存され、再読み込み後も保持されます
- 現在のリスト状態を URL に埋め込んで共有できます
- iPhone / Android のホーム画面追加を想定した PWA 風の構成です
- 画像が未配置でも表示が崩れにくいようにしてあります

## ファイル構成

- `index.html`
- `style.css`
- `script.js`
- `manifest.webmanifest`
- `README.md`

将来追加予定の画像ファイル:

- `favicon.png`
- `apple-touch-icon.png`
- `ogp.png`
- `icon-192.png`
- `icon-512.png`

## 使い方

1. `index.html` をブラウザで開きます
2. 入力欄に買うものを入力して「追加」を押します
3. よく使うものは定番追加ボタンからすぐ入れられます
4. チェックを入れると完了扱いになり、下に移動します
5. 「削除」で個別削除、「完了済み削除」「すべて削除」で一括整理できます
6. `Share` ボタンで現在のリスト状態を共有できます

## GitHub Pages 公開方法

1. このフォルダ一式を GitHub リポジトリに配置します
2. リポジトリの `Settings` を開きます
3. `Pages` を開きます
4. `Build and deployment` の `Source` を `Deploy from a branch` にします
5. 公開したいブランチとフォルダを選びます
   - 例: `main` ブランチの `/root`
   - このアプリだけを置くなら、そのままルート配置で問題ありません
6. 数分待つと公開 URL が発行されます

## iPhone ホーム画面追加方法

iPhone では Web ページ側から直接「ホーム画面に追加」ダイアログを開けません。  
アプリ内の「ホーム画面に追加」ボタンを押すと、案内モーダルを表示します。

手順:

1. Safari でアプリを開く
2. 共有ボタンをタップ
3. 「ホーム画面に追加」を選ぶ
4. 名前を確認して追加する

## Android ホーム画面追加方法

Android では `manifest.webmanifest` と `beforeinstallprompt` を使って、対応ブラウザでインストール導線を出します。

手順:

1. 対応ブラウザでアプリを開く
2. アプリ内の「ホーム画面に追加」ボタンを押す
3. インストール確認が出たら追加する

未対応ブラウザでは、ブラウザメニューから「ホーム画面に追加」や「アプリをインストール」を選んでください。

## シェア URL の仕組み

現在のリスト状態を次の流れで URL に変換しています。

1. リストデータを `JSON.stringify` で JSON 化
2. `encodeURIComponent` で日本語を安全に変換
3. `btoa` で Base64 化
4. URL パラメータ `?data=...` に格納

データのイメージ:

```json
{
  "items": [
    { "name": "牛乳", "done": false },
    { "name": "卵", "done": true }
  ]
}
```

ページ読み込み時は `URLSearchParams` で `data` を取得し、Base64 をデコードしてリストを復元します。  
共有 URL を開いた場合は、その内容を localStorage にも保存します。

## 後から追加する画像一覧

- `favicon.png`: ブラウザタブやブックマーク用
- `apple-touch-icon.png`: iPhone のホーム画面アイコン用
- `ogp.png`: SNS 共有時の OGP 画像用
- `icon-192.png`: Android / PWA 用アイコン
- `icon-512.png`: Android / PWA 用大型アイコン

画像がまだなくても、相対パスの参照だけ先に入っているため後から差し替えやすい構成です。
