import express, { type Request, type Response } from "express";
import { upsertNagiUserProfileIfConfigured } from "../firestore/user-profile.js";
import { listAnnouncementEntries } from "./announcements-store.js";
import { DUMMY_USERS, findDummyUserById } from "./dummy-users.js";
import {
  applyMoodDailyChoiceForActor,
  approvePendingMember,
  createOwnedPair,
  getActiveInviteForPairOwner,
  getMoodDailyPromptForActor,
  getMyMoodForPair,
  getMyWhisperForPair,
  getPairPrivacySettingsForActor,
  getPairSummaryForUser,
  listPairMembersForActor,
  listChatMessagesForActor,
  listNotificationsForActor,
  listPairSummariesForUser,
  listPendingMemberUserIdsForPair,
  postChatMessageForActor,
  redeemInviteCode,
  resolveCalendarDayForApi,
  saveMyMoodForPair,
  saveMyWhisperForPair,
  setActivePairForUser,
  setPairPrivacySettingsForActor,
} from "./pair-store.js";
import { isRelationshipTagId } from "./relationship-tags.js";
import { isDummyAuthAllowed } from "../../lib/is-dummy-auth.js";

function jsonError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

function firstQueryString(v: unknown): string | undefined {
  if (typeof v === "string") {
    return v;
  }
  if (Array.isArray(v) && typeof v[0] === "string") {
    return v[0];
  }
  return undefined;
}

function registerHealth(r: express.Router): void {
  r.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true as const, service: "nagi-api" });
  });
}

function registerAnnouncements(r: express.Router): void {
  r.get("/announcements", (req: Request, res: Response) => {
    const user = req.nagiUser;
    if (user === undefined) {
      jsonError(res, 401, "unauthorized", "利用者がまだ選ばれていません");
      return;
    }
    res.json({ announcements: listAnnouncementEntries() });
  });
}

function registerMe(r: express.Router): void {
  r.get("/me/pairs", async (req: Request, res: Response) => {
    const user = req.nagiUser;
    if (user === undefined) {
      jsonError(res, 401, "unauthorized", "利用者がまだ選ばれていません");
      return;
    }
    const pairs = await listPairSummariesForUser(user.id);
    const active = await getPairSummaryForUser(user.id);
    res.json({
      pairs,
      activePairId: active?.id ?? null,
    });
  });

  r.put("/me/active-pair", async (req: Request, res: Response) => {
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
    const pairIdRaw = (body as Record<string, unknown>).pairId;
    if (typeof pairIdRaw !== "string" || pairIdRaw.trim() === "") {
      jsonError(res, 400, "validation_error", "ペアを読み取れませんでした");
      return;
    }

    const switched = await setActivePairForUser(user.id, pairIdRaw.trim());
    if (!switched.ok) {
      jsonError(res, 403, "forbidden", "そのペアには、まだ入っていません");
      return;
    }

    const pair = await getPairSummaryForUser(user.id);
    if (pair === null) {
      jsonError(res, 500, "internal_error", "切り替え直後の状態を読み取れませんでした");
      return;
    }

    res.json({ pair });
  });

  r.get("/me", async (req: Request, res: Response) => {
    const user = req.nagiUser;
    if (user === undefined) {
      jsonError(res, 401, "unauthorized", "利用者がまだ選ばれていません");
      return;
    }
    try {
      await upsertNagiUserProfileIfConfigured(user);
    } catch (e) {
      console.warn("upsertNagiUserProfileIfConfigured", e);
    }
    const pair = await getPairSummaryForUser(user.id);
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
  r.post("/invites/redeem", async (req: Request, res: Response) => {
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

    const result = await redeemInviteCode(user.id, codeRaw);
    if (!result.ok) {
      if (result.reason === "already_in_this_pair") {
        jsonError(res, 409, "conflict", "すでにこのペアに入っています");
        return;
      }
      if (result.reason === "pairs_limit_for_user") {
        jsonError(res, 409, "conflict", "入れるペア数の上限に近いです");
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
    if (!isDummyAuthAllowed()) {
      jsonError(res, 404, "not_found", "この入口は、使われていません");
      return;
    }
    res.json({
      users: DUMMY_USERS.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        note: u.note,
      })),
    });
  });
}

function isChatRetentionChoice(value: unknown): value is "none" | "30days" | "90days" {
  return value === "none" || value === "30days" || value === "90days";
}

function registerPairs(r: express.Router): void {
  r.post("/pairs", async (req: Request, res: Response) => {
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

    const created = await createOwnedPair(user.id, {
      pairDisplayName,
      relationshipTag: relationshipTagRaw,
    });

    if (!created.ok) {
      jsonError(res, 409, "conflict", "入れるペア数の上限に近いです");
      return;
    }

    const pair = await getPairSummaryForUser(user.id);
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

  r.get("/pairs/:pairId/members", async (req: Request, res: Response) => {
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

    const listed = await listPairMembersForActor(user.id, pairId);
    if (!listed.ok) {
      if (listed.reason === "forbidden") {
        jsonError(res, 403, "forbidden", "この操作には入れません");
        return;
      }
      jsonError(res, 404, "not_found", "ペアが見つかりません");
      return;
    }

    const members = listed.members.map((row) => ({
      userId: row.userId,
      displayName: findDummyUserById(row.userId)?.displayName ?? "名前が未登録の利用者",
      role: row.role,
      membershipState: row.membershipState,
    }));

    res.json({ members });
  });

  r.get("/pairs/:pairId/settings/privacy", async (req: Request, res: Response) => {
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

    const privacy = await getPairPrivacySettingsForActor(user.id, pairId);
    if (!privacy.ok) {
      if (privacy.reason === "forbidden") {
        jsonError(res, 403, "forbidden", "この操作には入れません");
        return;
      }
      jsonError(res, 404, "not_found", "ペアが見つかりません");
      return;
    }

    res.json({ chatRetention: privacy.chatRetention });
  });

  r.put("/pairs/:pairId/settings/privacy", async (req: Request, res: Response) => {
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

    const body = req.body as unknown;
    if (body === null || typeof body !== "object") {
      jsonError(res, 400, "validation_error", "入力を読み取れませんでした");
      return;
    }
    const chatRetentionRaw = (body as Record<string, unknown>).chatRetention;
    if (!isChatRetentionChoice(chatRetentionRaw)) {
      jsonError(res, 400, "validation_error", "保存の値が、読み取れませんでした");
      return;
    }

    const updated = await setPairPrivacySettingsForActor(user.id, pairId, chatRetentionRaw);
    if (!updated.ok) {
      if (updated.reason === "forbidden") {
        jsonError(res, 403, "forbidden", "この操作には入れません");
        return;
      }
      jsonError(res, 404, "not_found", "ペアが見つかりません");
      return;
    }

    res.json({ chatRetention: updated.chatRetention });
  });

  r.get("/pairs/:pairId/mood/daily-prompt", async (req: Request, res: Response) => {
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

    const dateRaw = firstQueryString(req.query.date);
    const resolved = resolveCalendarDayForApi(dateRaw);
    if (!resolved.ok) {
      jsonError(res, 400, "validation_error", "日付を読み取れませんでした");
      return;
    }

    const got = await getMoodDailyPromptForActor(user.id, pairId, resolved.dayKey);
    if (!got.ok) {
      if (got.reason === "validation_error") {
        jsonError(res, 400, "validation_error", "日付を読み取れませんでした");
        return;
      }
      if (got.reason === "forbidden") {
        jsonError(res, 403, "forbidden", "この操作には入れません");
        return;
      }
      jsonError(res, 404, "not_found", "ペアが見つかりません");
      return;
    }

    res.json({
      date: got.dayKey,
      promptId: got.promptId,
      question: got.question,
      choices: got.choices,
    });
  });

  r.post("/pairs/:pairId/mood/daily-choice", async (req: Request, res: Response) => {
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

    const body = req.body as unknown;
    if (body === null || typeof body !== "object") {
      jsonError(res, 400, "validation_error", "入力を読み取れませんでした");
      return;
    }
    const rec = body as Record<string, unknown>;
    const choiceRaw = rec.choiceId;
    if (typeof choiceRaw !== "string") {
      jsonError(res, 400, "validation_error", "選び方を読み取れませんでした");
      return;
    }

    const dateResolved = resolveCalendarDayForApi(rec.date);
    if (!dateResolved.ok) {
      jsonError(res, 400, "validation_error", "日付を読み取れませんでした");
      return;
    }

    const saved = await applyMoodDailyChoiceForActor(user.id, pairId, dateResolved.dayKey, choiceRaw);
    if (!saved.ok) {
      if (saved.reason === "forbidden") {
        jsonError(res, 403, "forbidden", "この操作には入れません");
        return;
      }
      if (saved.reason === "not_found") {
        jsonError(res, 404, "not_found", "ペアが見つかりません");
        return;
      }
      jsonError(res, 400, "validation_error", "選び方か、長さの上限に合いませんでした");
      return;
    }

    res.status(201).json({ mood: saved.mood });
  });

  r.get("/pairs/:pairId/mood", async (req: Request, res: Response) => {
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

    const dateRaw = firstQueryString(req.query.date);
    const resolved = resolveCalendarDayForApi(dateRaw);
    if (!resolved.ok) {
      jsonError(res, 400, "validation_error", "日付を読み取れませんでした");
      return;
    }

    const got = await getMyMoodForPair(user.id, pairId, resolved.dayKey);
    if (!got.ok) {
      if (got.reason === "forbidden") {
        jsonError(res, 403, "forbidden", "この操作には入れません");
        return;
      }
      jsonError(res, 404, "not_found", "ペアが見つかりません");
      return;
    }

    res.json({ date: got.dayKey, mood: got.mood });
  });

  r.put("/pairs/:pairId/mood", async (req: Request, res: Response) => {
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

    const body = req.body as unknown;
    if (body === null || typeof body !== "object") {
      jsonError(res, 400, "validation_error", "入力を読み取れませんでした");
      return;
    }
    const bodyRaw = (body as Record<string, unknown>).body;
    if (typeof bodyRaw !== "string") {
      jsonError(res, 400, "validation_error", "文章を読み取れませんでした");
      return;
    }

    const dateResolved = resolveCalendarDayForApi((body as Record<string, unknown>).date);
    if (!dateResolved.ok) {
      jsonError(res, 400, "validation_error", "日付を読み取れませんでした");
      return;
    }

    const saved = await saveMyMoodForPair(user.id, pairId, dateResolved.dayKey, bodyRaw);
    if (!saved.ok) {
      if (saved.reason === "forbidden") {
        jsonError(res, 403, "forbidden", "この操作には入れません");
        return;
      }
      if (saved.reason === "not_found") {
        jsonError(res, 404, "not_found", "ペアが見つかりません");
        return;
      }
      if (bodyRaw.trim().length === 0) {
        jsonError(res, 400, "validation_error", "文章が、まだありません");
        return;
      }
      jsonError(res, 400, "validation_error", "文章が長すぎます");
      return;
    }

    res.json({ mood: saved.mood });
  });

  r.get("/pairs/:pairId/whisper", async (req: Request, res: Response) => {
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

    const dateRaw = firstQueryString(req.query.date);
    const resolved = resolveCalendarDayForApi(dateRaw);
    if (!resolved.ok) {
      jsonError(res, 400, "validation_error", "日付を読み取れませんでした");
      return;
    }

    const got = await getMyWhisperForPair(user.id, pairId, resolved.dayKey);
    if (!got.ok) {
      if (got.reason === "forbidden") {
        jsonError(res, 403, "forbidden", "この操作には入れません");
        return;
      }
      jsonError(res, 404, "not_found", "ペアが見つかりません");
      return;
    }

    res.json({ date: got.dayKey, whisper: got.whisper });
  });

  r.put("/pairs/:pairId/whisper", async (req: Request, res: Response) => {
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

    const body = req.body as unknown;
    if (body === null || typeof body !== "object") {
      jsonError(res, 400, "validation_error", "入力を読み取れませんでした");
      return;
    }
    const bodyRaw = (body as Record<string, unknown>).body;
    if (typeof bodyRaw !== "string") {
      jsonError(res, 400, "validation_error", "文章を読み取れませんでした");
      return;
    }

    const dateResolved = resolveCalendarDayForApi((body as Record<string, unknown>).date);
    if (!dateResolved.ok) {
      jsonError(res, 400, "validation_error", "日付を読み取れませんでした");
      return;
    }

    const saved = await saveMyWhisperForPair(user.id, pairId, dateResolved.dayKey, bodyRaw);
    if (!saved.ok) {
      if (saved.reason === "forbidden") {
        jsonError(res, 403, "forbidden", "この操作には入れません");
        return;
      }
      if (saved.reason === "not_found") {
        jsonError(res, 404, "not_found", "ペアが見つかりません");
        return;
      }
      if (bodyRaw.trim().length === 0) {
        jsonError(res, 400, "validation_error", "文章が、まだありません");
        return;
      }
      jsonError(res, 400, "validation_error", "文章が長すぎます");
      return;
    }

    res.json({ whisper: saved.whisper });
  });

  r.get("/pairs/:pairId/notifications", async (req: Request, res: Response) => {
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

    const listed = await listNotificationsForActor(user.id, pairId);
    if (!listed.ok) {
      if (listed.reason === "forbidden") {
        jsonError(res, 403, "forbidden", "この操作には入れません");
        return;
      }
      jsonError(res, 404, "not_found", "ペアが見つかりません");
      return;
    }

    res.json({ notifications: listed.notifications });
  });

  r.get("/pairs/:pairId/chat/messages", async (req: Request, res: Response) => {
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

    const listed = await listChatMessagesForActor(user.id, pairId);
    if (!listed.ok) {
      if (listed.reason === "forbidden") {
        jsonError(res, 403, "forbidden", "この操作には入れません");
        return;
      }
      jsonError(res, 404, "not_found", "ペアが見つかりません");
      return;
    }

    res.json({ messages: listed.messages });
  });

  r.post("/pairs/:pairId/chat/messages", async (req: Request, res: Response) => {
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

    const body = req.body as unknown;
    if (body === null || typeof body !== "object") {
      jsonError(res, 400, "validation_error", "入力を読み取れませんでした");
      return;
    }
    const rec = body as Record<string, unknown>;
    const textRaw = rec.text;
    if (typeof textRaw !== "string") {
      jsonError(res, 400, "validation_error", "文章を読み取れませんでした");
      return;
    }
    const topicRaw = rec.topicUserId;
    let topicUserId: string | null = null;
    if (typeof topicRaw === "string" && topicRaw.trim() !== "") {
      topicUserId = topicRaw.trim();
    } else if (topicRaw !== undefined && topicRaw !== null) {
      jsonError(res, 400, "validation_error", "話題の指定を読み取れませんでした");
      return;
    }

    const posted = await postChatMessageForActor(user.id, pairId, textRaw, topicUserId);
    if (!posted.ok) {
      if (posted.reason === "forbidden") {
        jsonError(res, 403, "forbidden", "この操作には入れません");
        return;
      }
      if (posted.reason === "not_found") {
        jsonError(res, 404, "not_found", "ペアが見つかりません");
        return;
      }
      if (posted.reason === "bad_topic") {
        jsonError(res, 400, "validation_error", "話題の人が、見つかりません");
        return;
      }
      if (textRaw.trim().length === 0) {
        jsonError(res, 400, "validation_error", "文章が、まだありません");
        return;
      }
      jsonError(res, 400, "validation_error", "文章が長すぎます");
      return;
    }

    res.status(201).json({ messages: posted.messages });
  });

  r.get("/pairs/:pairId/pending-members", async (req: Request, res: Response) => {
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

    const listed = await listPendingMemberUserIdsForPair(pairId, user.id);
    if (!listed.ok) {
      if (listed.reason === "forbidden") {
        jsonError(res, 403, "forbidden", "この操作には入れません");
        return;
      }
      jsonError(res, 404, "not_found", "ペアが見つかりません");
      return;
    }

    const members = listed.userIds.map((uid) => {
      const du = findDummyUserById(uid);
      return {
        userId: uid,
        displayName: du?.displayName ?? "名前が未登録の利用者",
      };
    });

    res.json({ members });
  });

  r.post("/pairs/:pairId/members/:memberUserId/approve", async (req: Request, res: Response) => {
    const user = req.nagiUser;
    if (user === undefined) {
      jsonError(res, 401, "unauthorized", "利用者がまだ選ばれていません");
      return;
    }

    const pairId = req.params.pairId;
    const memberUserId = req.params.memberUserId;
    if (pairId === undefined || pairId.trim() === "" || memberUserId === undefined || memberUserId.trim() === "") {
      jsonError(res, 404, "not_found", "対象が見つかりません");
      return;
    }

    const approved = await approvePendingMember(user.id, pairId, memberUserId);
    if (!approved.ok) {
      if (approved.reason === "forbidden") {
        jsonError(res, 403, "forbidden", "この操作には入れません");
        return;
      }
      if (approved.reason === "not_found") {
        jsonError(res, 404, "not_found", "対象が見つかりません");
        return;
      }
      jsonError(res, 409, "conflict", "いまは承認の対象になっていません");
      return;
    }

    res.status(200).json({ ok: true as const });
  });

  r.get("/pairs/:pairId/invite", async (req: Request, res: Response) => {
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

    const inv = await getActiveInviteForPairOwner(pairId, user.id);
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
  registerAnnouncements(r);
  registerPairs(r);
  registerInvites(r);
  registerDevDummyUsers(r);
  return r;
}
