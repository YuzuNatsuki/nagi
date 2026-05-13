import express, { type Request, type Response } from "express";
import { DUMMY_USERS } from "./dummy-users.js";
import {
  createOwnedPair,
  getActiveInviteForPairOwner,
  getPairSummaryForUser,
  redeemInviteCode,
} from "./pair-store.js";
import { isRelationshipTagId } from "./relationship-tags.js";

function jsonError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

function registerHealth(r: express.Router): void {
  r.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true as const, service: "nagi-api" });
  });
}

function registerMe(r: express.Router): void {
  r.get("/me", (req: Request, res: Response) => {
    const user = req.nagiUser;
    if (user === undefined) {
      jsonError(res, 401, "unauthorized", "利用者がまだ選ばれていません");
      return;
    }
    const pair = getPairSummaryForUser(user.id);
    res.json({
      user: {
        id: user.id,
        displayName: user.displayName,
      },
      pair,
    });
  });
}

/** Phase 1 専用: フロントのダミー利用者切替と一覧を同期する */
function registerInvites(r: express.Router): void {
  r.post("/invites/redeem", (req: Request, res: Response) => {
    const user = req.nagiUser;
    if (user === undefined) {
      jsonError(res, 401, "unauthorized", "利用者がまだ選ばれていません");
      return;
    }

    const body = req.body as unknown;
    if (body === null || typeof body !== "object") {
      jsonError(res, 400, "validation_error", "入力を読み取れませんでした");
      return;
    }

    const record = body as Record<string, unknown>;
    const codeRaw = record.code;
    if (typeof codeRaw !== "string") {
      jsonError(res, 400, "validation_error", "入力を読み取れませんでした");
      return;
    }

    if (codeRaw.trim() === "") {
      jsonError(res, 400, "validation_error", "コードが、まだありません");
      return;
    }

    const result = redeemInviteCode(user.id, codeRaw);
    if (!result.ok) {
      if (result.reason === "already_in_pair") {
        jsonError(res, 409, "conflict", "すでにほかのペアに入っています");
        return;
      }
      if (result.reason === "code_not_found") {
        jsonError(res, 404, "not_found", "コードが見つかりません");
        return;
      }
      if (result.reason === "invite_unusable") {
        jsonError(res, 410, "invite_unusable", "この招待は、もう使えません");
        return;
      }
      if (result.reason === "pair_full") {
        jsonError(res, 409, "conflict", "このペアは、人数の上限に近いです");
        return;
      }
      if (result.reason === "cannot_join_own_pair") {
        jsonError(res, 409, "conflict", "自分のペアへは、この入口からは入れません");
        return;
      }
      jsonError(res, 500, "internal_error", "想定外の状態です");
      return;
    }

    res.status(201).json({ pair: result.pair });
  });
}

function registerDevDummyUsers(r: express.Router): void {
  r.get("/dev/dummy-users", (_req: Request, res: Response) => {
    res.json({
      users: DUMMY_USERS.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        note: u.note,
      })),
    });
  });
}

function registerPairs(r: express.Router): void {
  r.post("/pairs", (req: Request, res: Response) => {
    const user = req.nagiUser;
    if (user === undefined) {
      jsonError(res, 401, "unauthorized", "利用者がまだ選ばれていません");
      return;
    }

    const body = req.body as unknown;
    if (body === null || typeof body !== "object") {
      jsonError(res, 400, "validation_error", "入力を読み取れませんでした");
      return;
    }

    const record = body as Record<string, unknown>;
    const pairDisplayNameRaw = record.pairDisplayName;
    const relationshipTagRaw = record.relationshipTag;

    if (typeof pairDisplayNameRaw !== "string" || typeof relationshipTagRaw !== "string") {
      jsonError(res, 400, "validation_error", "入力を読み取れませんでした");
      return;
    }

    if (!isRelationshipTagId(relationshipTagRaw)) {
      jsonError(res, 400, "validation_error", "関係性の値が、読み取れませんでした");
      return;
    }

    const pairDisplayName = pairDisplayNameRaw.trim();
    if (pairDisplayName.length === 0) {
      jsonError(res, 400, "validation_error", "表示名が、まだありません");
      return;
    }
    if (pairDisplayName.length > 40) {
      jsonError(res, 400, "validation_error", "表示名が長すぎます");
      return;
    }

    const created = createOwnedPair(user.id, {
      pairDisplayName,
      relationshipTag: relationshipTagRaw,
    });

    if (!created.ok) {
      jsonError(res, 409, "conflict", "すでにほかのペアに入っています");
      return;
    }

    const pair = getPairSummaryForUser(user.id);
    if (pair === null) {
      jsonError(res, 500, "internal_error", "作成直後の状態を読み取れませんでした");
      return;
    }

    res.status(201).json({
      pair,
      invite: {
        code: created.invite.code,
        expiresAt: created.invite.expiresAtIso,
      },
    });
  });

  r.get("/pairs/:pairId/invite", (req: Request, res: Response) => {
    const user = req.nagiUser;
    if (user === undefined) {
      jsonError(res, 401, "unauthorized", "利用者がまだ選ばれていません");
      return;
    }

    const pairId = req.params.pairId;
    if (pairId === undefined || pairId.trim() === "") {
      jsonError(res, 404, "not_found", "ペアが見つかりません");
      return;
    }

    const inv = getActiveInviteForPairOwner(pairId, user.id);
    if (!inv.ok) {
      if (inv.reason === "forbidden") {
        jsonError(res, 403, "forbidden", "この操作には入れません");
        return;
      }
      if (inv.reason === "not_found") {
        jsonError(res, 404, "not_found", "招待が見つかりません");
        return;
      }
      jsonError(res, 410, "invite_unusable", "この招待は、もう使えません");
      return;
    }

    res.json({
      code: inv.code,
      expiresAt: inv.expiresAtIso,
    });
  });
}

/** in-memory 実装の HTTP ルート（RUNTIME_BACKEND_ADAPTER からのみマウントする） */
export function createInMemoryApiRoutes(): express.Router {
  const r = express.Router();
  registerHealth(r);
  registerMe(r);
  registerPairs(r);
  registerInvites(r);
  registerDevDummyUsers(r);
  return r;
}
