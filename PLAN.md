# 凪 (nagi) 実装計画

## 進め方

- この計画は軽量運用とし、仕様は `SPEC.md` と本 `PLAN.md` に集約する。
- 承認タイミングは次の 3 つのみ:
  - `SPEC.md` / `PLAN.md` 初版確認
  - Phase 1: 1 画面完成ごとの確認
  - Phase 2: 1 ユニット完成ごとの確認 (テスト + build 通過後)

## 決定事項

- 添付資料基準: **B** (ユーザー提示の正式版を絶対制約として扱う)
- Phase 1 認証モデル: **A** (固定ダミーユーザー切替)
- API 境界方針: **D 採用**
  - 切替点を `backend/src/adapters/runtime-backend-adapter.ts` 1 箇所に集約
  - 固定識別子 `RUNTIME_BACKEND_ADAPTER` で探索可能にする
- UI ライブラリ: **B** (Tailwind CSS)
- Phase 1 画面完了判定: **C** (見た目 + 操作 + 接続 + 最低限テスト + 文言トーン確認)

## Phase 1: モックアップフェーズ

### 0. 土台準備

- [x] モノレポ構成を初期化 (`frontend` / `backend`)
- [x] TypeScript strict と Vitest 基盤を設定
- [x] `npm run dev` でフロント + ダミー API 同時起動を構築
- [x] Tailwind CSS を導入し、色・余白・タイポの基準トークンを定義
- [x] ダミー API 共通仕様 (レスポンス shape / エラー shape / 403 仕様) を確定
- [x] 固定ダミーユーザー切替の仕組みを実装
- [x] `runtime-backend-adapter` のインターフェースのみ先に確定

### 1. 画面実装 (指定順)

- [x] 1) 起動時のオンボーディング
- [x] 2) ペア作成フォーム
- [x] 3) 招待コード発行・共有画面
- [x] 4) 招待コード入力画面
- [x] 5) 承認待ち画面 (被招待側)
- [ ] 6) 承認画面 (オーナー側)
- [ ] 7) ペア一覧と切替
- [ ] 8) メンバー一覧 + プライバシー設定
- [ ] 9) Mood 入力
- [ ] 10) Whisper 入力
- [ ] 11) 通知履歴
- [ ] 12) お知らせパネル
- [ ] 13) 凪に話す (チャット)
- [ ] 14) 設定

### 2. ダミーバックエンド完成条件

- [ ] `/api/*` を Express で実装し in-memory で状態遷移
- [ ] 100〜400ms のランダム遅延を全 API に適用
- [ ] 招待コード発行、入力、pending_approval、承認まで一連動作
- [ ] 認可エラーの形を本番想定で統一 (他人データ取得は 403)
- [ ] 通知文ダミー生成をテンプレート + 分岐 + 乱数で実装
- [ ] チャット応答ダミー生成をキーワード分岐で実装 (100〜800ms 遅延)
- [ ] チャット保持設定 (`none` / `30days` / `90days`) と期限削除を実装
- [ ] Notifications API を使ったブラウザ通知検証を実装

### 3. 画面横断の品質

- [ ] 各画面の最低限 UI テストを追加
- [ ] 主要 API の単体テストを追加
- [ ] 文言がトーン規則を満たすことをレビュー
- [ ] 画面遷移の通し動作を確認
- [ ] ユーザー確認で「UI 確定」を得る

## Phase 2: 本実装フェーズ

### Unit 5: ペア基盤

- [ ] Firestore へペア・招待・承認モデルを実装
- [ ] 招待コード失効 / 使い切り / 監査ログを実装
- [ ] 認可ポリシーを本実装へ置換
- [ ] property-based test を含むテスト完了

### Unit 3: 3 エージェント + Vertex AI

- [ ] observation / interpretation / notification を分離実装
- [ ] Vertex AI (Gemini 2.0 Flash 系) 呼び出しを本実装
- [ ] トーン二段ガード (プロンプト + サーバフィルタ) を実装
- [ ] 通知とチャットのプロンプト/予算管理を分離
- [ ] property-based test を含むテスト完了

### Unit 4: 通知配送 + KMS / Secret Manager / Tasks

- [ ] KMS 暗号化保存を実装 (ローカルは AES-GCM fallback)
- [ ] Secret Manager 読み出しを実装
- [ ] Cloud Tasks / Scheduler による配送・sweeper を実装
- [ ] FCM / Web Push 経由の通知配送を実装
- [ ] property-based test を含むテスト完了

### Unit 1: Mood

- [ ] Mood API と Firestore 永続化を実装
- [ ] private 設定と認可制御を実装
- [ ] property-based test を含むテスト完了

### Unit 2: Whisper

- [ ] Whisper API と Firestore 永続化を実装
- [ ] private 設定と認可制御を実装
- [ ] property-based test を含むテスト完了

### 仕上げ

- [ ] 全 feature flag 切替の動作確認
- [ ] `tsc --noEmit` / test / build を全通過
- [ ] 監視指標・ログ構造の最終確認
- [ ] 禁止事項に抵触しないことを最終確認

## 完了条件チェック

- [ ] 仕様が `SPEC.md` と整合している
- [ ] すべての画面が指定順で完成し確認済み
- [ ] すべてのユニットが完成定義を満たして確認済み
- [ ] ダミーと本実装の境界が 1 箇所に維持されている
