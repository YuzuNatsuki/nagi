import type { NextFunction, Request, Response } from "express";
import { findDummyUserById } from "../adapters/in-memory/dummy-users.js";

const HEADER = "x-nagi-user-id";

/**
 * Phase 1: `X-Nagi-User-Id` で固定ダミー利用者を解決する。
 * 未送信のルートは `req.nagiUser` が空のまま（匿名）とする。
 */
export function authContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const raw = req.header(HEADER);
  if (raw === undefined || raw.trim() === "") {
    next();
    return;
  }
  const user = findDummyUserById(raw.trim());
  if (user !== undefined) {
    req.nagiUser = user;
  }
  next();
}
