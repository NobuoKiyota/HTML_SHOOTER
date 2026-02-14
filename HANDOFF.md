# HTML5 Top-Down Shooter Framework Handoff Document

このプロジェクトは、拡張性の高い HTML5 シューティングゲームのフレームワークです。
主要なシステム構成と、今後の調整方法について記載します。

## プロジェクト構造

- `index.html`: エントリポイント。UI構造を定義。
- `css/style.css`: ゲーム画面のレイアウトとアニメーション。
- `js/`
    - `engine.js`: メインループ、状態遷移、エンティティ管理。
    - `soundManager.js`: SE（Web Audio）と BGM（HTML5 Audio）の統合管理。
    - `gridManager.js`: 船体カスタム（グリッドベース）のロジック。
    - `missionManager.js`: ミッション自動生成エンジン。
    - `saveManager.js`: ローカルストレージへのセーブ・ロード。
    - `settings_data.js`: JSONから同期された定数データ。
- `json/`: ゲームバランスを定義する各種設定ファイル。
- `sounds/`: 音声ファイル（MP3/WAV）。
- `tools/sync_settings.py`: JSONデータを `settings_data.js` に変換する同期スクリプト。

## サウンドシステムの仕様

### BGMの切り替え
`js/soundManager.js` で管理されており、以下の3つのパスが定義されています：
- `OUTGAME`: タイトル、メニュー、強化、リザルトで使用。フェードアウト時に位置を記憶し、再開時にそこからフェードインします。
- `INGAME_A`: ★1～2のミッション用。
- `INGAME_B`: ★3以上のミッション用。

### 効果音（SE）
`SoundManager.SES` オブジェクトにキーを定義し、`sounds/` フォルダ内のWAVファイルを読み込みます。
現在はクリック、射撃、爆発、アイテム取得などが実装済みです。

## ゲームバランスの調整方法

### Excel経由（推奨）
1. `game_balance.xlsx` 内の各シートを編集。
2. `python tools/sync_settings.py` を実行して、変更をゲームに反映。

### JSONの直接編集
`json/` 内のファイルを編集後、同様に同期スクリプトを実行してください。
- `physics.json`: 船の速度、重力（慣性）、ミッション距離のスケールなど。
- `parts.json`: グリッドパーツの重さ、価格、効果。
- `upgrades.json`: アウトゲームでの機体強化コストと上昇値。

## 今後の拡張案
- **新しいパーツの追加**: `GridManager.PART_TEMPLATES` に定義を追加するだけで新機能を実装可能。
- **デブリの種類増加**: `debris.json` に新しいエントリーを追加し、色や行動パターン（homing値）を調整。
- **背景演出**: 現在はシンプルなスクロールですが、`drawBackground` にパーティクルや流星の描画を追加することで質感を高められます。

---
Enjoy building!
