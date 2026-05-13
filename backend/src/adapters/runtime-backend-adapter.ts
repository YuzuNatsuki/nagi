import express from "express";
import { createInMemoryApiRoutes } from "./in-memory/api-routes.js";
import { apiDelayMiddleware } from "../middleware/api-delay.js";
import { authContextMiddleware } from "../middleware/auth-context.js";

/**
 * RUNTIME_BACKEND_ADAPTER
 *
 * ダミー実装と本実装の切替点はこのファイルだけに集約する。
 * Phase 1: in-memory のみ。Phase 2: 環境変数で Firestore 等へ差し替え。
 */
export function createApiRouter(): express.Router {
  const router = express.Router();
  router.use(apiDelayMiddleware);
  router.use(authContextMiddleware);
  router.use(createInMemoryApiRoutes());
  return router;
}
