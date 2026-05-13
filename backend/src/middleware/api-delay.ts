import type { NextFunction, Request, Response } from "express";

/** Phase 1: ローディング表現の検証用。100〜400ms のランダム待機。 */
export function apiDelayMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  const ms = Math.floor(100 + Math.random() * 301);
  setTimeout(() => {
    next();
  }, ms);
}
