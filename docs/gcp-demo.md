# 凪 (nagi) デモ用 GCP の骨

Phase 2 本実装と並行して使う、**最短でデモ URL に繋ぐ**ための手順です。  
リポジトリには次が含まれます。

- `Dockerfile` … API（Express）のみのコンテナ
- `.github/workflows/gcp-api-image.yml` … Artifact Registry へイメージ push
- `firebase.json` … Hosting でフロントの静的ファイル配信（SPA）
- フロント `VITE_PUBLIC_API_ORIGIN` … ビルド時に Cloud Run の URL を埋め込み、ブラウザから API を叩く

## 1. GCP プロジェクトと API（Cloud Run + Artifact Registry）

1. GCP でプロジェクトを作成（または既存を使用）。
2. **Artifact Registry** に Docker リポジトリ `nagi` を作成（例: リージョン `asia-northeast1`）。
  ```bash
   gcloud config set project YOUR_PROJECT_ID
   gcloud artifacts repositories create nagi \
     --repository-format=docker \
     --location=asia-northeast1 \
     --description="nagi API images"
  ```
3. GitHub Actions 用の**サービスアカウント**を作成し、少なくとも次を付与する。
  - `roles/artifactregistry.writer`（イメージ push）
  - （後で Run にデプロイするなら）`roles/run.admin` と `roles/iam.serviceAccountUser` など
4. その SA の **JSON 鍵**を発行し、GitHub リポジトリの **Secrets** に登録する。
  - `GCP_SA_JSON` … 鍵 JSON の全文
  - `GCP_PROJECT_ID` … プロジェクト ID（文字列）
5. `main` にマージするか **Actions の「Run workflow」** で `gcp-api-image` を実行し、イメージが `asia-northeast1-docker.pkg.dev/.../nagi-api:<sha>` に載ることを確認する。
6. **Cloud Run** に手動デプロイ（初回の骨）。
  ```bash
   IMAGE="asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/nagi/nagi-api:latest"
   gcloud run deploy nagi-api \
     --image="${IMAGE}" \
     --region=asia-northeast1 \
     --allow-unauthenticated \
     --port=8080 \
     --set-env-vars=NODE_ENV=production,BIND_HOST=0.0.0.0
  ```
   表示された **サービス URL**（`https://....run.app`）を控える。API は `/api/...` 配下。

## 2. フロント（Firebase Hosting）と API の向き先

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトを作成（GCP と同じプロジェクトにリンクしてもよい）。
2. Hosting を有効にする。
3. リポジトリの `firebase.json` は `public: frontend/dist` を指している。
4. `.firebaserc.example` をコピーして `.firebaserc` を作り、`YOUR_FIREBASE_PROJECT_ID` を実 ID に置き換える。
  ```bash
   cp .firebaserc.example .firebaserc
   # 編集して default を Firebase プロジェクト ID に
  ```
5. **ビルド時**に Cloud Run のオリジンを渡す（末尾スラッシュなし）。
  ```bash
   export VITE_PUBLIC_API_ORIGIN="https://nagi-api-xxxxx-xx.a.run.app"
   npm ci
   npm run build -w frontend
  ```
6. Firebase CLI でデプロイ（初回は `firebase login` が必要）。
  ```bash
   npm install -g firebase-tools
   firebase deploy --only hosting
  ```

Hosting の URL（`https://....web.app`）がデモ用のフロントになる。

## 3. CORS

API は `cors` で **リクエストの `Origin` をそのまま許可**する設定（`origin: true`）にしてある。  
Firebase Hosting のオリジンからブラウザで Cloud Run を叩ける。

## 4. 次の一歩（Phase 2）

- Firebase **Authentication**（メール＋パスワード）と、API のトークン検証
- **Firestore** に `pairs` / `invites` などを移す
- Cloud Run デプロイを **GitHub Actions** に乗せる、`latest` 以外のタグ運用

## 補足: ローカル開発

`VITE_PUBLIC_API_ORIGIN` を付けずに `npm run dev` すれば、従来どおり Vite のプロキシで `127.0.0.1:8787` に届く。

API の listen アドレスは、コンテナでは `Dockerfile` の `ENV BIND_HOST=0.0.0.0`、ローカル `npm run start -w backend` では既定 `127.0.0.1`（必要なら `BIND_HOST` で上書き）。