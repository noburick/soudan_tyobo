# soudan_tyobo

散弾の**購入数・使用数・残数**を管理する、GitHub Pagesで公開可能な装弾帳簿Webアプリです。

- 技術: HTML / CSS / JavaScript
- 保存方式: localStorage（ブラウザ内保存）
- 目的: スマホから素早く更新できるシンプル運用

---

## 機能

- 購入記録追加
- 使用記録追加
- 装弾種類マスタ登録（登録済みから選択可）
- 現在在庫の自動計算
- 履歴表示
- 履歴削除
- CSVエクスポート
- スマホ向けレスポンシブUI（ダークテーマ寄り）

入力項目:

- 日付
- 装弾名
- 口径
- 号数
- グラム数
- 区分（購入 / 使用）
- 数量
- 用途・メモ

---

## ファイル構成

- `index.html` : 画面構成
- `style.css` : スタイル（ダークテーマ/レスポンシブ）
- `script.js` : データ処理・描画・CSV出力
- `README.md` : 本ドキュメント

---

## 使い方（GitHub初心者向け）

1. GitHubでこのリポジトリを開く
2. `index.html` をGitHub Pagesで公開（手順は下記）
3. 公開URLをスマホのホームに追加
4. フォームに入力して「記録を追加」
5. 在庫と履歴が自動更新
6. 必要に応じて履歴の「削除」
7. バックアップしたい場合は「CSVエクスポート」

---

## GitHub Pages 公開手順

1. リポジトリの **Settings** を開く
2. 左メニューの **Pages** を開く
3. **Source** で以下を選択
   - Branch: `main`（または公開したいブランチ）
   - Folder: `/ (root)`
4. **Save** を押す
5. 数十秒〜数分後に公開URLが表示される
6. `index.html` がトップページとして表示される

---

## データ保存仕様（localStorage）

- キー名:
  - 記帳データ: `soudan_tyobo_records`（旧キー `soudanTyoboRecords` からの読み込み互換あり）
  - 装弾種類マスタ: `soudan_tyobo_ammo_types`
- バックアップキー:
  - `soudan_tyobo_records_backup`
  - `soudan_tyobo_ammo_types_backup`
- 形式: JSON配列
- 1件の記録例（概念）
  - `id`: 一意ID
  - `createdAt`: 作成時刻（ミリ秒）
  - `date`: 日付
  - `ammoName`: 装弾名
  - `caliber`: 口径
  - `shotSize`: 号数
  - `grams`: グラム数
  - `type`: `purchase` または `use`
  - `quantity`: 数量
  - `memo`: 用途・メモ

注意:

- 保存先は**使用中のブラウザ端末内**です。
- 別端末・別ブラウザには自動同期されません。
- ブラウザデータ消去で消える可能性があります。

---

## 将来のGitHub API保存への拡張方針

このアプリは、データ操作を関数分割した構成にしてあり、保存先の切り替えがしやすい設計です。

現在の主な責務:

- `loadRecords()` : 記録読み込み
- `saveRecords(records)` : 記録保存
- `addRecord(record)` : 追記
- `deleteRecord(id)` : 削除

将来は上記関数の内部実装を差し替えることで、次のような拡張が可能です。

1. `localStorage` ではなく GitHub上のJSONファイルを読み書き
2. 保存時にGitHub APIでJSONを更新
3. 認証はGitHub OAuth / GitHub App等へ移行

※ 今回は要件どおり、Personal Access Tokenは使わず localStorage保存のみ実装しています。
