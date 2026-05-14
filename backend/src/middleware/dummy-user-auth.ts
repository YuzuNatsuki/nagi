import type { NextFunction, Request, Response } from "express";
import { findDummyUserById } from "../adapters/in-memory/dummy-users.js";
import { isDummyAuthAllowed } from "../lib/is-dummy-auth.js";

const HEADER = "x-nagi-user-id";

/**
 * Phase 1: `X-Nagi-User-Id` で固定ダミー利用者を解決する。
 * 既に `req.nagiUser` があるとき（Firebase Bearer 済み）は上書きしない。
 */
export function dummyUserAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.nagiUser !== undefined) {
    next();
    return;
  }
  if (!isDummyAuthAllowed()) {
    next();
    return;
  }

  const raw = req.header(HEADER);
  if (raw === undefined || raw.trim() === "") {
    next();
    return;
  }
  const dummy = findDummyUserById(raw.trim());
  if (dummy !== undefined) {
    req.nagiUser = { id: dummy.id, displayName: dummy.displayName };
  }
  next();
}
