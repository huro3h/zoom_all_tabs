---
name: zoom-all-tabs
description: Zoom All Tabs Chrome拡張機能（Manifest V3）の開発・改修ガイド。開いている全タブのズーム倍率を一括変更する機能、バッジ表示、カスタム倍率、キーボードショートカットの実装知識を含む。background.js / popup.js / popup.html / manifest.json を編集するときに使う。
---

# Zoom All Tabs 拡張機能ガイド

開いているすべてのタブのズーム倍率を、ポップアップまたはキーボードショートカットで一括変更する Chrome 拡張機能（Manifest V3）。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `manifest.json` | Manifest V3 設定。`tabs`/`storage` 権限、service worker、6つのショートカットコマンドを宣言 |
| `background.js` | Service worker。ズーム一括変更の中核ロジック、バッジ更新、タブイベント処理 |
| `popup.html` | ポップアップ UI（固定ズーム 4種 + カスタム 2種 + 設定入力） |
| `popup.js` | ポップアップの操作ハンドラ。カスタム倍率の読み込み・保存、メッセージ送信 |
| `icons/` | 16/48/128px アイコン |

## アーキテクチャ

### 操作の2経路
1. **ポップアップのボタン** → `popup.js` が `chrome.runtime.sendMessage({action:'changeZoom', zoomFactor})` を送信 → `background.js` の `onMessage` が受信
2. **キーボードショートカット** → `background.js` の `chrome.commands.onCommand` が直接受信

どちらも最終的に `changeAllTabsZoom(zoomFactor)` に集約される。

### コマンドと倍率の対応
- `background.js` の `ZOOM_FACTOR_BY_COMMAND` が固定倍率（a-zoom-90=0.9, b-zoom-100=1.0, c-zoom-110=1.1, d-zoom-125=1.25）を定義
- `e-custom-zoom-1` / `f-custom-zoom-2` はストレージの `custom1`/`custom2` を参照（既定値 1.50 / 2.00）
- コマンド ID は `a-` `b-` … のプレフィックスで**ショートカット設定画面の並び順を制御**している。リネーム時は順序に注意

### ストレージのキー（chrome.storage.local）
- `custom1` / `custom2` … カスタム倍率（0〜1 の factor 値で保存。UI 上は %）

## 重要な実装ポイント（改修時の注意）

### 0. ズーム適用は既定スコープ（per-origin）
`changeAllTabsZoom` は各タブに `chrome.tabs.setZoom(tabId, zoomFactor)` を直接呼ぶだけ。スコープ操作（`setZoomSettings`）はしない。Chrome の既定スコープは `per-origin` で、その倍率は `chrome://settings/content/zoomLevels` にオリジン単位で永続保存されるため、**リロードしてもズームは自然に保持される**（再適用処理は不要）。反面、タブを閉じても倍率は残る（既定スコープの仕様）。

> 補足: 以前は `per-tab` スコープ＋リーク対策＋リロード再適用の機構を持っていたが、ドラッグ操作時のカクツキ（適用時の一瞬のリセット往復が原因）を招いていたため撤去し、素の per-origin 適用に戻した。`per-tab` に戻す改修をする場合は、リロードで倍率が消える問題とカクツキが再発する点に注意。

### 1. システムページのスキップ
`changeAllTabsZoom` と `onUpdated` の両方で `chrome://` `edge://` `brave://` `about:` を除外している（`isBrowserInternalPage()` に共通化）。新しいブラウザ内部スキームを扱う場合は `isBrowserInternalPage` を更新すれば両箇所に反映される。

### 2. タブ消失時のエラーハンドリング
`changeAllTabsZoom` は各タブの `setZoom` を try/catch で包み、適用前に閉じられたタブは想定内としてログのみ出す。全タブを `Promise.all` で並行処理する。

### 3. バッジ表示
`updateTabZoomBadge` / `drawZoomPercentageBadge` が現在のズーム倍率を % でバッジに表示（背景色 `#4682B4`）。`onZoomChange` `onActivated` `onUpdated`(complete) で更新。ローディング中（`onUpdated` status==='loading'）はバッジを空にする。

### 4. カスタム倍率の入力検証
`popup.js` の Save で 25〜500（%）の範囲チェック。範囲外は alert。保存は factor 値（%÷100）。manifest の input `min="25" max="500"` と一致させること。

## 動作確認方法
1. `chrome://extensions` で「デベロッパーモード」をオン
2. 「パッケージ化されていない拡張機能を読み込む」でこのディレクトリを選択
3. コード変更後は拡張機能カードの再読み込みボタンで反映（service worker は要リロード）
4. ショートカットキーは `chrome://extensions/shortcuts` で割り当て

## よくある改修タスク
- **固定倍率の追加/変更** → `ZOOM_FACTOR_BY_COMMAND`（background.js）+ `fixedZoomMap`（popup.js）+ `manifest.json` の commands + `popup.html` のボタンを揃える
- **カスタム倍率の増設** → storage キー・ZOOM_FACTOR_BY_COMMAND分岐・popup の input/button・manifest commands をセットで追加
- **新スキームの除外** → background.js の `isBrowserInternalPage()` に追記（両参照箇所へ反映される）
