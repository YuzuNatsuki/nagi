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
  - `GCP_PROJECT_ID` … プロジェクト ID（前後のスペース・改行は入れない。誤って入れると Docker タグが無効になる）
5. `main` にマージするか **Actions の「Run workflow」** で `gcp-api-image` を実行し、イメージが `asia-northeast1-docker.pkg.dev/.../nagi-api:<sha>` に載ることを確認する。
6. （任意）同じワークフローで **「Deploy to Cloud Run」をオン**にすると、ビルド後に **そのイメージで Cloud Run の `nagi-api` を更新**できる。GitHub 用 SA に `roles/run.admin` など Cloud Run 更新権限が必要。
7. **Cloud Run** に手動デプロイ（初回の骨）。
   ```bash
   IMAGE="asia-northeast1-docker.pkg.dev/YOUR_PROJECT_ID/nagi/nagi-api:latest"
   gcloud run deploy nagi-api \
     --image="${IMAGE}" \
     --region=asia-northeast1 \
     --allow-unauthenticated \
     --port=8080 \
     --set-env-vars=NODE_ENV=production,BIND_HOST=0.0.0.0
  ```
   2回目以降の更新でフルイメージ URL を打ちたくない場合は、`cp .env.deploy.example .env.deploy` に `GCP_PROJECT_ID` を書き、`npm run deploy:cloud-run`（中身は `scripts/deploy-cloud-run.sh`）で `.../nagi-api:latest` を組み立ててデプロイできる。

   表示された **サービス URL**（`https://....run.app`）を控える。API は `/api/...` 配下。

## 2. フロント（Firebase Hosting）と API の向き先

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトを作成（GCP と同じプロジェクトにリンクしてもよい）。
2. Hosting を有効にする。
3. リポジトリの `firebase.json` は `public: frontend/dist` を指している。**`/api/**` は Cloud Run の `nagi-api`（`asia-northeast1`）へリライト**し、そのほかを SPA の `index.html` に流す（この順でないと、相対 `/api` が HTML になり `Unexpected token '<'` になる）。
4. `.firebaserc.example` をコピーして `.firebaserc` を作り、`YOUR_FIREBASE_PROJECT_ID` を実 ID に置き換える（このファイルは **`.gitignore` 対象**でリポジトリに含めない。各自の手元にだけ置く）。
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

### メールログイン後に「状態を読み取れませんでした」（`/api/me` が失敗）

画面に詳細メッセージが出るようになっているので、まずその文言を確認する。よくある原因は次のとおり。

1. **Cloud Run の環境変数 `FIREBASE_PROJECT_ID`**（または `GCLOUD_PROJECT`）が、Firebase Authentication の **project ID** と一致していない。
2. **Hosting → Cloud Run リライト**後、Firebase が Cloud Run を呼ぶための **IAM**（`roles/run.invoker`）が足りない。`firebase deploy --only hosting` 後にコンソールで Cloud Run の「セキュリティ」やログを確認する。
3. **ブラウザの開発者ツール → ネットワーク**で `GET .../api/me` のステータス（401 / 403 / 503 など）とレスポンス本文を確認する。

## 4. Phase 2: メール認証と Firestore（開始済み）

1. Firebase Console で **Authentication**（メール／パスワード）と **Firestore** を有効にする。
2. フロント用に Web アプリ設定を取得し、リポジトリ直下の `.env.example` を参考に **`frontend/.env.local`** に `VITE_FIREBASE_*` と必要なら `VITE_PUBLIC_API_ORIGIN` を書く。
3. **API にプロジェクト ID とランタイム SA の権限（Cloud Run / ローカル）**  
   - **環境変数**  
     - コードは **`FIREBASE_PROJECT_ID`** を優先し、無ければ **`GCLOUD_PROJECT`** を参照します。Cloud Run は後者を自動で入れることがありますが、**`FIREBASE_PROJECT_ID` を明示する方が確実**です（値は Firebase の **project ID** と一致）。  
     - コンソール: Cloud Run → 対象サービス → **編集と新しいリビジョンのデプロイ** →「変数、シークレット、接続、セキュリティ」→ 環境変数。  
     - CLI の例:  
       `gcloud run services update nagi-api --region=asia-northeast1 --project=nagi-496300 --set-env-vars="FIREBASE_PROJECT_ID=nagi-496300"`  
   - **ランタイム用サービス アカウント（SA）**  
     - Cloud Run の同じ画面の **サービス アカウント** に表示されるメールが「API が動く主体」です。GitHub Actions 用の SA（Artifact Registry に push する鍵の SA）とは**別**です。  
     - **Firestore** に Admin SDK で `users/{uid}` を書くには、この SA に少なくとも **`roles/datastore.user`**（プロジェクトにバインド）など、データストアへの書き込みが通る権限を付けます。  
     - 付与例（`RUNTIME_SA_EMAIL` を Cloud Run に表示されたメールに置き換え）:  
       `gcloud projects add-iam-policy-binding nagi-496300 --member="serviceAccount:RUNTIME_SA_EMAIL" --role="roles/datastore.user"`  
   - **ID トークン検証**  
     - `verifyIdToken` は公開鍵で署名を検証するため、「検証専用の IAM ロールが必ずこれ」というより、**ADC が付いた SA で Admin SDK が起動できればよい**理解で足りることが多いです。失敗する場合は `FIREBASE_PROJECT_ID` の誤りや ADC 未設定を疑います。  
   - **ローカル**で Bearer まで試すとき: 手元で **`gcloud auth application-default login`** を実行し、同じターミナルで **`export FIREBASE_PROJECT_ID=...`** してから `npm run dev -w backend` します。
4. 初回デプロイ後、ルート **`firestore.rules`** を `firebase deploy --only firestore:rules` で反映する（クライアント直アクセスは閉じ、API のみ Admin で書く想定）。
5. 本番でダミーヘッダを切るときは **`NAGI_DUMMY_AUTH=0`**。`/api/dev/dummy-users` は応答しなくなる。
6. 認証済みの **`GET /api/me`** のたびに、Firestore の **`users/{uid}`** に `displayName` と `updatedAt` を upsert する（`FIRESTORE_ENABLED=0` で無効化可能）。**ペアや招待の本体はまだ in-memory** で、次の変更で Firestore に載せ替える。

## 5. 次の一歩（Phase 2 続き）

- **Firestore** に `pairs` / `invites` などを移す（Unit 5）
- Cloud Run デプロイを **GitHub Actions** に乗せる、`latest` 以外のタグ運用

## 補足: ローカル開発

`VITE_PUBLIC_API_ORIGIN` を付けずに `npm run dev` すれば、従来どおり Vite のプロキシで `127.0.0.1:8787` に届く。

API の listen アドレスは、コンテナでは `Dockerfile` の `ENV BIND_HOST=0.0.0.0`、ローカル `npm run start -w backend` では既定 `127.0.0.1`（必要なら `BIND_HOST` で上書き）。