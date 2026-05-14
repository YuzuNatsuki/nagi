import { randomBytes } from "node:crypto";
import type { RelationshipTagId } from "./relationship-tags.js";

/**
 * Phase 1: ペア所属の in-memory 状態。
 * 画面追加に合わせてミューテーション API を足す。
 */

export type PairMembershipState = "active" | "pending_owner_approval";

export type PairSummaryForUser = {
  id: string;
  displayName: string;
  yourRole: "owner" | "member";
  membershipState: PairMembershipState;
  relationshipTag: RelationshipTagId;
};

export type PairCreateResult =
  | {
      ok: true;
      pairId: string;
      invite: { code: string; expiresAtIso: string };
    }
  | { ok: false; reason: "pairs_limit_reached" };

export type ChatRetentionChoice = "none" | "30days" | "90days";

export type NotificationHistoryItem = {
  id: string;
  headline: string;
  body: string;
  createdAt: string;
};

export type ChatMessageRole = "user" | "assistant";

export type ChatMessageRow = {
  id: string;
  role: ChatMessageRole;
  body: string;
  createdAt: string;
  topicUserId: string | null;
};

type PairRecord = {
  id: string;
  displayName: string;
  ownerUserId: string;
  relationshipTag: RelationshipTagId;
};

type MembershipRecord = {
  pairId: string;
  role: "owner" | "member";
  state: PairMembershipState;
};

type InviteRecord = {
  pairId: string;
  code: string;
  expiresAtMs: number;
  consumed: boolean;
};

const pairs = new Map<string, PairRecord>();
const userMemberships = new Map<string, MembershipRecord[]>();
/** いまの画面コンテキストとして使うペア。所属一覧に無い値は無視し、先頭へ戻す。 */
const activePairIdByUser = new Map<string, string>();
const invitesByPairId = new Map<string, InviteRecord>();
/** 利用者ごと・ペアごとのプライバシー（Phase 1 モック）。キーは `${userId}::${pairId}`。 */
const chatRetentionByUserPair = new Map<string, ChatRetentionChoice>();
/** 本人だけが読める「今日のメモ」（Phase 1 モック）。キーは `${userId}::${pairId}::${YYYY-MM-DD}`。 */
const moodByUserPairDay = new Map<string, { body: string; savedAtIso: string }>();
/** 本人だけが読める「ひとりごとメモ」（Phase 1 モック）。キーは `${userId}::${pairId}::${YYYY-MM-DD}`。 */
const whisperByUserPairDay = new Map<string, { body: string; savedAtIso: string }>();
/** 日別導入前の単一行「今日のメモ」。初回アクセス時に指定日へ移す。 */
const latestMoodByUserPair = new Map<string, { body: string; savedAtIso: string }>();
/** 日別導入前の単一行「ひとりごとメモ」。初回アクセス時に指定日へ移す。 */
const latestWhisperByUserPair = new Map<string, { body: string; savedAtIso: string }>();
/** 利用者×ペアごとの通知履歴（Phase 1 モック・メモリ内のみ）。 */
const notificationHistoryByUserPair = new Map<string, NotificationHistoryItem[]>();
const chatMessagesByUserPair = new Map<string, ChatMessageRow[]>();

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const INVITE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const MAX_PAIR_MEMBERS = 4;
const MAX_PAIRS_PER_USER = 4;

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function generateInviteCode(): string {
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 12; i += 1) {
    out += INVITE_ALPHABET[bytes[i]! % INVITE_ALPHABET.length]!;
  }
  return out;
}

function membershipList(userId: string): MembershipRecord[] {
  return userMemberships.get(userId) ?? [];
}

function setMembershipList(userId: string, list: MembershipRecord[]): void {
  if (list.length === 0) {
    userMemberships.delete(userId);
    activePairIdByUser.delete(userId);
    return;
  }
  userMemberships.set(userId, list);
}

function findMembership(userId: string, pairId: string): MembershipRecord | undefined {
  return membershipList(userId).find((m) => m.pairId === pairId);
}

function upsertMembership(userId: string, record: MembershipRecord): void {
  const list = membershipList(userId).filter((m) => m.pairId !== record.pairId);
  list.push(record);
  setMembershipList(userId, list);
}

function countUserPairs(userId: string): number {
  return membershipList(userId).length;
}

/** 単体テスト用。本番コードからは呼ばない。 */
export function resetInMemoryPairStateForTests(): void {
  pairs.clear();
  userMemberships.clear();
  activePairIdByUser.clear();
  invitesByPairId.clear();
  chatRetentionByUserPair.clear();
  moodByUserPairDay.clear();
  whisperByUserPairDay.clear();
  latestMoodByUserPair.clear();
  latestWhisperByUserPair.clear();
  notificationHistoryByUserPair.clear();
  chatMessagesByUserPair.clear();
}

function userPairKey(userId: string, pairId: string): string {
  return `${userId}::${pairId}`;
}

function userPairDayKey(userId: string, pairId: string, dayKey: string): string {
  return `${userId}::${pairId}::${dayKey}`;
}

const CALENDAR_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 暦日 YYYY-MM-DD。不正なら null。 */
export function parseCalendarDayStrict(raw: unknown): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    return null;
  }
  const s = raw.trim();
  const m = CALENDAR_DAY_RE.exec(s);
  if (m === null) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return s;
}

function defaultCalendarDayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** API 用。省略時は UTC の暦日「今日」。 */
export function resolveCalendarDayForApi(raw: unknown): { ok: true; dayKey: string } | { ok: false } {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, dayKey: defaultCalendarDayUtc() };
  }
  const parsed = parseCalendarDayStrict(raw);
  if (parsed === null) {
    return { ok: false };
  }
  return { ok: true, dayKey: parsed };
}

function migrateLegacyMoodIfNeeded(userId: string, pairId: string, targetDayKey: string): void {
  const legacyKey = userPairKey(userId, pairId);
  const legacy = latestMoodByUserPair.get(legacyKey);
  if (legacy === undefined) {
    return;
  }
  const dk = userPairDayKey(userId, pairId, targetDayKey);
  if (!moodByUserPairDay.has(dk)) {
    moodByUserPairDay.set(dk, { body: legacy.body, savedAtIso: legacy.savedAtIso });
  }
  latestMoodByUserPair.delete(legacyKey);
}

function migrateLegacyWhisperIfNeeded(userId: string, pairId: string, targetDayKey: string): void {
  const legacyKey = userPairKey(userId, pairId);
  const legacy = latestWhisperByUserPair.get(legacyKey);
  if (legacy === undefined) {
    return;
  }
  const dk = userPairDayKey(userId, pairId, targetDayKey);
  if (!whisperByUserPairDay.has(dk)) {
    whisperByUserPairDay.set(dk, { body: legacy.body, savedAtIso: legacy.savedAtIso });
  }
  latestWhisperByUserPair.delete(legacyKey);
}

function isActiveMemberOfPair(userId: string, pairId: string): boolean {
  const m = findMembership(userId, pairId);
  return m !== undefined && m.state === "active";
}

function countMembersForPair(pairId: string): number {
  let n = 0;
  for (const list of userMemberships.values()) {
    for (const m of list) {
      if (m.pairId === pairId) {
        n += 1;
      }
    }
  }
  return n;
}

function findInviteByExactCode(code: string): InviteRecord | null {
  for (const inv of invitesByPairId.values()) {
    if (inv.code === code) {
      return inv;
    }
  }
  return null;
}

function summaryFromMembership(userId: string, m: MembershipRecord): PairSummaryForUser | null {
  const pair = pairs.get(m.pairId);
  if (pair === undefined) {
    return null;
  }
  return {
    id: pair.id,
    displayName: pair.displayName,
    yourRole: m.role,
    membershipState: m.state,
    relationshipTag: pair.relationshipTag,
  };
}

function resolveActiveMembership(userId: string): MembershipRecord | null {
  const list = membershipList(userId);
  if (list.length === 0) {
    return null;
  }
  const preferred = activePairIdByUser.get(userId);
  if (preferred !== undefined) {
    const hit = list.find((m) => m.pairId === preferred);
    if (hit !== undefined) {
      return hit;
    }
  }
  const first = list[0]!;
  activePairIdByUser.set(userId, first.pairId);
  return first;
}

export type RedeemInviteResult =
  | { ok: true; pair: PairSummaryForUser }
  | {
      ok: false;
      reason:
        | "already_in_this_pair"
        | "pairs_limit_for_user"
        | "code_not_found"
        | "invite_unusable"
        | "pair_full"
        | "cannot_join_own_pair";
    };

export function redeemInviteCode(userId: string, rawCode: string): RedeemInviteResult {
  const code = rawCode.trim();
  if (code === "") {
    return { ok: false, reason: "code_not_found" };
  }

  const inv = findInviteByExactCode(code);
  if (inv === null) {
    return { ok: false, reason: "code_not_found" };
  }

  if (inv.consumed || Date.now() > inv.expiresAtMs) {
    return { ok: false, reason: "invite_unusable" };
  }

  const pair = pairs.get(inv.pairId);
  if (pair === undefined) {
    return { ok: false, reason: "code_not_found" };
  }

  if (pair.ownerUserId === userId) {
    return { ok: false, reason: "cannot_join_own_pair" };
  }

  if (findMembership(userId, inv.pairId) !== undefined) {
    return { ok: false, reason: "already_in_this_pair" };
  }

  if (countUserPairs(userId) >= MAX_PAIRS_PER_USER) {
    return { ok: false, reason: "pairs_limit_for_user" };
  }

  if (countMembersForPair(inv.pairId) >= MAX_PAIR_MEMBERS) {
    return { ok: false, reason: "pair_full" };
  }

  inv.consumed = true;

  upsertMembership(userId, {
    pairId: inv.pairId,
    role: "member",
    state: "pending_owner_approval",
  });

  activePairIdByUser.set(userId, inv.pairId);

  const summary = summaryFromMembership(userId, {
    pairId: inv.pairId,
    role: "member",
    state: "pending_owner_approval",
  });
  if (summary === null) {
    return { ok: false, reason: "code_not_found" };
  }

  return { ok: true, pair: summary };
}

export type ListPendingMembersResult =
  | { ok: true; userIds: string[] }
  | { ok: false; reason: "forbidden" | "not_found" };

export function listPendingMemberUserIdsForPair(pairId: string, actorUserId: string): ListPendingMembersResult {
  const pair = pairs.get(pairId);
  if (pair === undefined) {
    return { ok: false, reason: "not_found" };
  }
  if (pair.ownerUserId !== actorUserId) {
    return { ok: false, reason: "forbidden" };
  }
  const actorMem = findMembership(actorUserId, pairId);
  if (
    actorMem === undefined ||
    actorMem.role !== "owner" ||
    actorMem.state !== "active"
  ) {
    return { ok: false, reason: "forbidden" };
  }

  const userIds: string[] = [];
  for (const [uid, list] of userMemberships.entries()) {
    const m = list.find((x) => x.pairId === pairId);
    if (m !== undefined && m.role === "member" && m.state === "pending_owner_approval") {
      userIds.push(uid);
    }
  }
  return { ok: true, userIds };
}

function issueFreshInviteForPair(pairId: string): void {
  const code = generateInviteCode();
  const expiresAtMs = Date.now() + INVITE_TTL_MS;
  invitesByPairId.set(pairId, {
    pairId,
    code,
    expiresAtMs,
    consumed: false,
  });
}

export type ApproveMemberResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "not_found" | "not_pending" };

export function approvePendingMember(
  actorUserId: string,
  pairId: string,
  memberUserId: string,
): ApproveMemberResult {
  const pair = pairs.get(pairId);
  if (pair === undefined) {
    return { ok: false, reason: "not_found" };
  }
  if (pair.ownerUserId !== actorUserId) {
    return { ok: false, reason: "forbidden" };
  }

  const actorMem = findMembership(actorUserId, pairId);
  if (
    actorMem === undefined ||
    actorMem.role !== "owner" ||
    actorMem.state !== "active"
  ) {
    return { ok: false, reason: "forbidden" };
  }

  const target = findMembership(memberUserId, pairId);
  if (target === undefined) {
    return { ok: false, reason: "not_found" };
  }
  if (target.role !== "member" || target.state !== "pending_owner_approval") {
    return { ok: false, reason: "not_pending" };
  }

  upsertMembership(memberUserId, {
    pairId,
    role: "member",
    state: "active",
  });

  issueFreshInviteForPair(pairId);
  return { ok: true };
}

export function getPairSummaryForUser(userId: string): PairSummaryForUser | null {
  const m = resolveActiveMembership(userId);
  if (m === null) {
    return null;
  }
  return summaryFromMembership(userId, m);
}

export function listPairSummariesForUser(userId: string): PairSummaryForUser[] {
  const out: PairSummaryForUser[] = [];
  for (const m of membershipList(userId)) {
    const s = summaryFromMembership(userId, m);
    if (s !== null) {
      out.push(s);
    }
  }
  return out;
}

export type SetActivePairResult = { ok: true } | { ok: false; reason: "not_member" };

export function setActivePairForUser(userId: string, pairId: string): SetActivePairResult {
  if (findMembership(userId, pairId) === undefined) {
    return { ok: false, reason: "not_member" };
  }
  activePairIdByUser.set(userId, pairId);
  return { ok: true };
}

export function createOwnedPair(
  ownerUserId: string,
  input: { pairDisplayName: string; relationshipTag: RelationshipTagId },
): PairCreateResult {
  if (countUserPairs(ownerUserId) >= MAX_PAIRS_PER_USER) {
    return { ok: false, reason: "pairs_limit_reached" };
  }

  const pairId = newId("pair");
  const code = generateInviteCode();
  const expiresAtMs = Date.now() + INVITE_TTL_MS;

  pairs.set(pairId, {
    id: pairId,
    displayName: input.pairDisplayName,
    ownerUserId,
    relationshipTag: input.relationshipTag,
  });

  upsertMembership(ownerUserId, {
    pairId,
    role: "owner",
    state: "active",
  });

  activePairIdByUser.set(ownerUserId, pairId);

  invitesByPairId.set(pairId, {
    pairId,
    code,
    expiresAtMs,
    consumed: false,
  });

  return {
    ok: true,
    pairId,
    invite: { code, expiresAtIso: new Date(expiresAtMs).toISOString() },
  };
}

export type InviteLookupResult =
  | { ok: true; code: string; expiresAtIso: string }
  | { ok: false; reason: "forbidden" | "not_found" | "expired" | "consumed" };

export function getActiveInviteForPairOwner(pairId: string, userId: string): InviteLookupResult {
  const pair = pairs.get(pairId);
  if (pair === undefined) {
    return { ok: false, reason: "not_found" };
  }
  if (pair.ownerUserId !== userId) {
    return { ok: false, reason: "forbidden" };
  }
  const inv = invitesByPairId.get(pairId);
  if (inv === undefined) {
    return { ok: false, reason: "not_found" };
  }
  if (inv.consumed) {
    return { ok: false, reason: "consumed" };
  }
  if (Date.now() > inv.expiresAtMs) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, code: inv.code, expiresAtIso: new Date(inv.expiresAtMs).toISOString() };
}

export type PairMemberListItem = {
  userId: string;
  role: "owner" | "member";
  membershipState: PairMembershipState;
};

export type ListPairMembersResult =
  | { ok: true; members: PairMemberListItem[] }
  | { ok: false; reason: "forbidden" | "not_found" };

export function listPairMembersForActor(actorUserId: string, pairId: string): ListPairMembersResult {
  if (!pairs.has(pairId)) {
    return { ok: false, reason: "not_found" };
  }
  if (!isActiveMemberOfPair(actorUserId, pairId)) {
    return { ok: false, reason: "forbidden" };
  }
  const members: PairMemberListItem[] = [];
  for (const [uid, list] of userMemberships.entries()) {
    const m = list.find((x) => x.pairId === pairId);
    if (m !== undefined) {
      members.push({
        userId: uid,
        role: m.role,
        membershipState: m.state,
      });
    }
  }
  members.sort((a, b) => a.userId.localeCompare(b.userId));
  return { ok: true, members };
}

export type PairPrivacyResult =
  | { ok: true; chatRetention: ChatRetentionChoice }
  | { ok: false; reason: "forbidden" | "not_found" };

export function getPairPrivacySettingsForActor(actorUserId: string, pairId: string): PairPrivacyResult {
  if (!pairs.has(pairId)) {
    return { ok: false, reason: "not_found" };
  }
  if (!isActiveMemberOfPair(actorUserId, pairId)) {
    return { ok: false, reason: "forbidden" };
  }
  const stored = chatRetentionByUserPair.get(userPairKey(actorUserId, pairId));
  return { ok: true, chatRetention: stored ?? "30days" };
}

export function setPairPrivacySettingsForActor(
  actorUserId: string,
  pairId: string,
  chatRetention: ChatRetentionChoice,
): PairPrivacyResult {
  if (!pairs.has(pairId)) {
    return { ok: false, reason: "not_found" };
  }
  if (!isActiveMemberOfPair(actorUserId, pairId)) {
    return { ok: false, reason: "forbidden" };
  }
  chatRetentionByUserPair.set(userPairKey(actorUserId, pairId), chatRetention);
  return { ok: true, chatRetention };
}

const MAX_SOLO_BODY_CHARS = 2000;

type MoodDailyPromptDef = {
  question: string;
  labels: string[];
  lines: string[];
};

/** Phase 1: 日付＋ペアで決まる「今日のメモ」用の質問（ダミー AI）。 */
const MOOD_DAILY_PROMPTS: MoodDailyPromptDef[] = [
  {
    question: "いまの眠気の度合いに近いのは、どれですか。",
    labels: ["ほとんどない", "少しある", "つよい", "わからない"],
    lines: [
      "眠気はほとんど感じていません。",
      "眠気が少しあります。",
      "眠気がつよめです。",
      "眠気の度合いは、まだはっきりしません。",
    ],
  },
  {
    question: "からだの重さに近いのは、どれですか。",
    labels: ["軽め", "ふつう", "重め", "わからない"],
    lines: [
      "からだはいま、軽めに感じます。",
      "からだの重さは、ふつうです。",
      "からだはいま、重めに感じます。",
      "からだの重さは、まだわかりません。",
    ],
  },
  {
    question: "いまの気持ちの色に近いのは、どれですか。",
    labels: ["明るめ", "まざりあい", "暗め", "つかめない"],
    lines: [
      "気持ちは、明るめの色に近いです。",
      "気持ちは、明るさと暗さがまざっている感じです。",
      "気持ちは、暗めの色に近いです。",
      "気持ちの色は、いまはつかめていません。",
    ],
  },
  {
    question: "今日の予定の多さに近いのは、どれですか。",
    labels: ["すいている", "ちょうどよい", "ぎっしり", "まだわからない"],
    lines: [
      "今日の予定は、すいているほうです。",
      "今日の予定は、ちょうどよい感じです。",
      "今日の予定は、ぎっしりめです。",
      "今日の予定の多さは、まだわかりません。",
    ],
  },
  {
    question: "外の空気に触れたい気持ちに近いのは、どれですか。",
    labels: ["つよく触れたい", "少しでよい", "いまは内向き", "わからない"],
    lines: [
      "外の空気に、つよく触れたい気持ちがあります。",
      "外の空気には、少し触れたいです。",
      "いまは、内向きの気持ちに近いです。",
      "外に出たい気持ちの度合いは、まだわかりません。",
    ],
  },
  {
    question: "だれかに話しかけたい気持ちに近いのは、どれですか。",
    labels: ["つよい", "少しある", "いまは静かがよい", "わからない"],
    lines: [
      "だれかに話しかけたい気持ちが、つよめです。",
      "だれかに話しかけたい気持ちが、少しあります。",
      "いまは、静かなほうがよさそうです。",
      "話しかけたい気持ちの度合いは、まだわかりません。",
    ],
  },
];

function moodDailyPromptIndex(dayKey: string, pairId: string): number {
  let h = 0;
  const s = `${dayKey}::${pairId}`;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)!) | 0;
  }
  return Math.abs(h) % MOOD_DAILY_PROMPTS.length;
}

export type MoodDailyChoiceItem = { id: string; label: string };

export type MoodDailyPromptPayload = {
  promptId: string;
  question: string;
  choices: MoodDailyChoiceItem[];
};

export function buildMoodDailyPromptPayload(dayKey: string, pairId: string): MoodDailyPromptPayload {
  const idx = moodDailyPromptIndex(dayKey, pairId);
  const def = MOOD_DAILY_PROMPTS[idx]!;
  return {
    promptId: `p${idx}`,
    question: def.question,
    choices: def.labels.map((label, i) => ({ id: String(i), label })),
  };
}

function moodDailyChoiceLine(dayKey: string, pairId: string, choiceId: string): string | null {
  const idx = moodDailyPromptIndex(dayKey, pairId);
  const def = MOOD_DAILY_PROMPTS[idx]!;
  const i = Number.parseInt(choiceId, 10);
  if (!Number.isInteger(i) || i < 0 || i >= def.lines.length) {
    return null;
  }
  return def.lines[i]!;
}

export type GetMoodDailyPromptResult =
  | { ok: true; dayKey: string } & MoodDailyPromptPayload
  | { ok: false; reason: "forbidden" | "not_found" | "validation_error" };

export function getMoodDailyPromptForActor(actorUserId: string, pairId: string, dayKey: string): GetMoodDailyPromptResult {
  if (!pairs.has(pairId)) {
    return { ok: false, reason: "not_found" };
  }
  if (!isActiveMemberOfPair(actorUserId, pairId)) {
    return { ok: false, reason: "forbidden" };
  }
  if (parseCalendarDayStrict(dayKey) === null) {
    return { ok: false, reason: "validation_error" };
  }
  const payload = buildMoodDailyPromptPayload(dayKey, pairId);
  return { ok: true, dayKey, ...payload };
}

export type ApplyMoodDailyChoiceResult =
  | { ok: true; mood: MoodSnapshot }
  | { ok: false; reason: "forbidden" | "not_found" | "validation_error" };

export function applyMoodDailyChoiceForActor(
  actorUserId: string,
  pairId: string,
  dayKey: string,
  choiceId: string,
): ApplyMoodDailyChoiceResult {
  if (!pairs.has(pairId)) {
    return { ok: false, reason: "not_found" };
  }
  if (!isActiveMemberOfPair(actorUserId, pairId)) {
    return { ok: false, reason: "forbidden" };
  }
  if (parseCalendarDayStrict(dayKey) === null) {
    return { ok: false, reason: "validation_error" };
  }
  const line = moodDailyChoiceLine(dayKey, pairId, choiceId);
  if (line === null) {
    return { ok: false, reason: "validation_error" };
  }
  migrateLegacyMoodIfNeeded(actorUserId, pairId, dayKey);
  const k = userPairDayKey(actorUserId, pairId, dayKey);
  const prev = moodByUserPairDay.get(k);
  const merged = prev === undefined ? line : `${prev.body.trimEnd()}\n${line}`;
  if (merged.length > MAX_SOLO_BODY_CHARS) {
    return { ok: false, reason: "validation_error" };
  }
  const savedAtIso = new Date().toISOString();
  moodByUserPairDay.set(k, { body: merged, savedAtIso });
  return { ok: true, mood: { date: dayKey, body: merged, savedAt: savedAtIso } };
}

export type MoodSnapshot = {
  date: string;
  body: string;
  savedAt: string;
};

export type GetMyMoodResult =
  | { ok: true; dayKey: string; mood: MoodSnapshot | null }
  | { ok: false; reason: "forbidden" | "not_found" };

export function getMyMoodForPair(actorUserId: string, pairId: string, dayKey: string): GetMyMoodResult {
  if (!pairs.has(pairId)) {
    return { ok: false, reason: "not_found" };
  }
  if (!isActiveMemberOfPair(actorUserId, pairId)) {
    return { ok: false, reason: "forbidden" };
  }
  migrateLegacyMoodIfNeeded(actorUserId, pairId, dayKey);
  const k = userPairDayKey(actorUserId, pairId, dayKey);
  const row = moodByUserPairDay.get(k);
  if (row === undefined) {
    return { ok: true, dayKey, mood: null };
  }
  return { ok: true, dayKey, mood: { date: dayKey, body: row.body, savedAt: row.savedAtIso } };
}

export type SaveMyMoodResult =
  | { ok: true; mood: MoodSnapshot }
  | { ok: false; reason: "forbidden" | "not_found" | "validation_error" };

export function saveMyMoodForPair(
  actorUserId: string,
  pairId: string,
  dayKey: string,
  body: string,
): SaveMyMoodResult {
  if (!pairs.has(pairId)) {
    return { ok: false, reason: "not_found" };
  }
  if (!isActiveMemberOfPair(actorUserId, pairId)) {
    return { ok: false, reason: "forbidden" };
  }
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "validation_error" };
  }
  if (trimmed.length > MAX_SOLO_BODY_CHARS) {
    return { ok: false, reason: "validation_error" };
  }
  migrateLegacyMoodIfNeeded(actorUserId, pairId, dayKey);
  const savedAtIso = new Date().toISOString();
  const k = userPairDayKey(actorUserId, pairId, dayKey);
  moodByUserPairDay.set(k, { body: trimmed, savedAtIso });
  return { ok: true, mood: { date: dayKey, body: trimmed, savedAt: savedAtIso } };
}

export type WhisperSnapshot = {
  date: string;
  body: string;
  savedAt: string;
};

export type GetMyWhisperResult =
  | { ok: true; dayKey: string; whisper: WhisperSnapshot | null }
  | { ok: false; reason: "forbidden" | "not_found" };

export function getMyWhisperForPair(actorUserId: string, pairId: string, dayKey: string): GetMyWhisperResult {
  if (!pairs.has(pairId)) {
    return { ok: false, reason: "not_found" };
  }
  if (!isActiveMemberOfPair(actorUserId, pairId)) {
    return { ok: false, reason: "forbidden" };
  }
  migrateLegacyWhisperIfNeeded(actorUserId, pairId, dayKey);
  const k = userPairDayKey(actorUserId, pairId, dayKey);
  const row = whisperByUserPairDay.get(k);
  if (row === undefined) {
    return { ok: true, dayKey, whisper: null };
  }
  return { ok: true, dayKey, whisper: { date: dayKey, body: row.body, savedAt: row.savedAtIso } };
}

export type SaveMyWhisperResult =
  | { ok: true; whisper: WhisperSnapshot }
  | { ok: false; reason: "forbidden" | "not_found" | "validation_error" };

export function saveMyWhisperForPair(
  actorUserId: string,
  pairId: string,
  dayKey: string,
  body: string,
): SaveMyWhisperResult {
  if (!pairs.has(pairId)) {
    return { ok: false, reason: "not_found" };
  }
  if (!isActiveMemberOfPair(actorUserId, pairId)) {
    return { ok: false, reason: "forbidden" };
  }
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "validation_error" };
  }
  if (trimmed.length > MAX_SOLO_BODY_CHARS) {
    return { ok: false, reason: "validation_error" };
  }
  migrateLegacyWhisperIfNeeded(actorUserId, pairId, dayKey);
  const savedAtIso = new Date().toISOString();
  const k = userPairDayKey(actorUserId, pairId, dayKey);
  whisperByUserPairDay.set(k, { body: trimmed, savedAtIso });
  return { ok: true, whisper: { date: dayKey, body: trimmed, savedAt: savedAtIso } };
}

function pairLabelForTemplates(pairId: string): string {
  const pair = pairs.get(pairId);
  return pair?.displayName ?? "このペア";
}

function buildSeedNotificationEntries(pairId: string): NotificationHistoryItem[] {
  const label = pairLabelForTemplates(pairId);
  let checksum = 0;
  for (let i = 0; i < pairId.length; i += 1) {
    checksum += pairId.charCodeAt(i)!;
  }
  const branch = (checksum + label.length) % 2;
  const now = Date.now();
  const msDay = 86400000;
  if (branch === 0) {
    return [
      {
        id: newId("ntf"),
        headline: "朝のかたち",
        body: `「${label}」は、いまは静かな一日のはじまりに近いようです。受け取り方は、あなたの手に残します。`,
        createdAt: new Date(now - msDay * 2).toISOString(),
      },
      {
        id: newId("ntf"),
        headline: "日中の気配",
        body: `「${label}」について、目立つ変化がなくても、空気の重さだけが少し違う、ということもあります。`,
        createdAt: new Date(now - msDay * 1).toISOString(),
      },
    ];
  }
  return [
    {
      id: newId("ntf"),
      headline: "夕方の輪郭",
      body: `「${label}」のまわりは、今日も穏やかに畳まれていきそうです。急がなくて大丈夫です。`,
      createdAt: new Date(now - msDay * 3).toISOString(),
    },
    {
      id: newId("ntf"),
      headline: "夜に向けて",
      body: `「${label}」について、いまは推察を増やさないほうが、落ち着きやすいかもしれません。`,
      createdAt: new Date(now - msDay * 1).toISOString(),
    },
  ];
}

export type ListNotificationsResult =
  | { ok: true; notifications: NotificationHistoryItem[] }
  | { ok: false; reason: "forbidden" | "not_found" };

export function listNotificationsForActor(actorUserId: string, pairId: string): ListNotificationsResult {
  if (!pairs.has(pairId)) {
    return { ok: false, reason: "not_found" };
  }
  if (!isActiveMemberOfPair(actorUserId, pairId)) {
    return { ok: false, reason: "forbidden" };
  }
  const key = userPairKey(actorUserId, pairId);
  let list = notificationHistoryByUserPair.get(key);
  if (list === undefined || list.length === 0) {
    list = buildSeedNotificationEntries(pairId);
    notificationHistoryByUserPair.set(key, list);
  }
  return { ok: true, notifications: [...list] };
}

const MAX_CHAT_BODY_CHARS = 4000;

function chatStorageKey(userId: string, pairId: string): string {
  return userPairKey(userId, pairId);
}

function retentionCutoffMs(chatRetention: ChatRetentionChoice): number {
  const now = Date.now();
  if (chatRetention === "none") {
    return now - 60 * 60 * 1000;
  }
  if (chatRetention === "30days") {
    return now - 30 * 86400000;
  }
  return now - 90 * 86400000;
}

function pruneChatMessages(actorUserId: string, pairId: string): void {
  const key = chatStorageKey(actorUserId, pairId);
  const priv = getPairPrivacySettingsForActor(actorUserId, pairId);
  if (!priv.ok) {
    return;
  }
  const cutoff = retentionCutoffMs(priv.chatRetention);
  const list = chatMessagesByUserPair.get(key) ?? [];
  const kept = list.filter((m) => new Date(m.createdAt).getTime() >= cutoff);
  chatMessagesByUserPair.set(key, kept);
}

function buildAssistantReply(userText: string, topicUserId: string | null): string {
  const t = userText.trim();
  const topicPrefix =
    topicUserId !== null && topicUserId !== ""
      ? "その方の話題に留めて推察しますが、"
      : "";
  if (/疲れ|つかれ/.test(t)) {
    return `${topicPrefix}いまの言葉には、からだの声が少し混じっているようにも見えます。休める幅を広げてもよさそうです。断定ではありません。`;
  }
  if (/心配|しんぱい/.test(t)) {
    return `${topicPrefix}気にかかっているようですね。事実と想像の境は、あえてゆるめておいてもよさそうです。`;
  }
  if (/天気|雨|晴/.test(t)) {
    return `${topicPrefix}空の話題に見えます。身のまわりの小さな変化として受け取ってもよいかもしれません。`;
  }
  if (/ありがと|感謝/.test(t)) {
    return `${topicPrefix}いまの言葉はやわらかいですね。その調子を保てば十分そうに見えます。`;
  }
  return `${topicPrefix}短い一行にも、いまの輪郭が少し映っているように感じます。急いで整えなくても大丈夫です。`;
}

function activeMemberUserIdsForPair(pairId: string): Set<string> {
  const ids = new Set<string>();
  for (const [uid, list] of userMemberships.entries()) {
    const m = list.find((x) => x.pairId === pairId && x.state === "active");
    if (m !== undefined) {
      ids.add(uid);
    }
  }
  return ids;
}

export type ListChatMessagesResult =
  | { ok: true; messages: ChatMessageRow[] }
  | { ok: false; reason: "forbidden" | "not_found" };

export function listChatMessagesForActor(actorUserId: string, pairId: string): ListChatMessagesResult {
  if (!pairs.has(pairId)) {
    return { ok: false, reason: "not_found" };
  }
  if (!isActiveMemberOfPair(actorUserId, pairId)) {
    return { ok: false, reason: "forbidden" };
  }
  pruneChatMessages(actorUserId, pairId);
  const key = chatStorageKey(actorUserId, pairId);
  const list = chatMessagesByUserPair.get(key) ?? [];
  return { ok: true, messages: [...list] };
}

export type PostChatMessageResult =
  | { ok: true; messages: ChatMessageRow[] }
  | { ok: false; reason: "forbidden" | "not_found" | "validation_error" | "bad_topic" };

export function postChatMessageForActor(
  actorUserId: string,
  pairId: string,
  text: string,
  topicUserId: string | null,
): PostChatMessageResult {
  if (!pairs.has(pairId)) {
    return { ok: false, reason: "not_found" };
  }
  if (!isActiveMemberOfPair(actorUserId, pairId)) {
    return { ok: false, reason: "forbidden" };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "validation_error" };
  }
  if (trimmed.length > MAX_CHAT_BODY_CHARS) {
    return { ok: false, reason: "validation_error" };
  }
  const members = activeMemberUserIdsForPair(pairId);
  let topic: string | null = topicUserId;
  if (topic !== null && topic !== "") {
    if (!members.has(topic)) {
      return { ok: false, reason: "bad_topic" };
    }
  } else {
    topic = null;
  }

  pruneChatMessages(actorUserId, pairId);
  const key = chatStorageKey(actorUserId, pairId);
  const list = [...(chatMessagesByUserPair.get(key) ?? [])];
  list.push({
    id: newId("cht"),
    role: "user",
    body: trimmed,
    createdAt: new Date().toISOString(),
    topicUserId: topic,
  });
  list.push({
    id: newId("cht"),
    role: "assistant",
    body: buildAssistantReply(trimmed, topic),
    createdAt: new Date().toISOString(),
    topicUserId: topic,
  });
  chatMessagesByUserPair.set(key, list);
  pruneChatMessages(actorUserId, pairId);
  const finalList = chatMessagesByUserPair.get(key) ?? [];
  return { ok: true, messages: [...finalList] };
}
