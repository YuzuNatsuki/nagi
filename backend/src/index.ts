import cors from "cors";
import express from "express";
import { createApiRouter } from "./adapters/runtime-backend-adapter.js";
import { ensureFirebaseAdminInitialized, resolveFirebaseProjectId } from "./lib/ensure-firebase-admin.js";

const app = express();
app.disable("x-powered-by");
app.use(
  cors({
    origin: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Nagi-User-Id",
      "X-Nagi-Firebase-Id-Token",
    ],
  }),
);
app.use(express.json({ limit: "1mb" }));

app.use("/api", createApiRouter());

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
/** Cloud Run 用イメージでは `BIND_HOST=0.0.0.0` を指定する。未指定時はローカル向けに 127.0.0.1。 */
const host = process.env.BIND_HOST ?? "127.0.0.1";

void ensureFirebaseAdminInitialized().then((ok) => {
  if (ok) {
    console.log(`[nagi] Firebase Admin initialized (projectId=${resolveFirebaseProjectId()})`);
  } else if (resolveFirebaseProjectId() !== "") {
    console.warn(
      "[nagi] FIREBASE_PROJECT_ID はあるが Admin 初期化に失敗しました。Firestore は書けません。ADC または Cloud Run の実行 SA を確認すると切り分けしやすいです。",
    );
  }
  app.listen(port, host, () => {
    console.log(`nagi-api listening on http://${host}:${port}`);
  });
});
