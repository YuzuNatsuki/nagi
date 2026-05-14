import express from "express";
import { createInMemoryApiRoutes } from "./in-memory/api-routes.js";
import { apiDelayMiddleware } from "../middleware/api-delay.js";
import { dummyUserAuthMiddleware } from "../middleware/dummy-user-auth.js";
import { firebaseBearerAuthMiddleware } from "../middleware/firebase-bearer-auth.js";

/**
 * RUNTIME_BACKEND_ADAPTER
 *
 * ダミー実装と本実装の切替点はこのファイルだけに集約する。
 * Phase 1: in-memory のみ。Phase 2: Firebase ID トークン検証 + Firestore（ユーザー文書）など。
 * チャット AI: Vertex AI のみ（ランタイム SA + ADC）。`src/lib/chat-assistant-reply.ts`。
 */
export function createApiRouter(): express.Router {
  const router = express.Router();
  router.use(apiDelayMiddleware);
  router.use(firebaseBearerAuthMiddleware);
  router.use(dummyUserAuthMiddleware);
  router.use(createInMemoryApiRoutes());
  return router;
}
