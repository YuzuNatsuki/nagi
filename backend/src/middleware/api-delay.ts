import type { NextFunction, Request, Response } from "express";

/**
 * Phase 1: ローディング表現の検証用。
 * 通常 API は 100〜400ms、チャットはやや長めに 100〜800ms。
 * Vitest 実行時は遅延を挟まない（HTTP 統合テストの安定と速度のため）。
 */
export function apiDelayMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (process.env.VITEST === "true") {
    next();
    return;
  }
  const path = req.path ?? "";
  const url = req.originalUrl ?? "";
  const isChat = path.includes("/chat/") || url.includes("/chat/");
  const span = isChat ? 701 : 301;
  const ms = Math.floor(100 + Math.random() * span);
  setTimeout(() => {
    next();
  }, ms);
}
