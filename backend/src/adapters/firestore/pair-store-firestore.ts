import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { appendPairAuditLogSafe } from "./pair-audit-log.js";
import type { RelationshipTagId } from "../in-memory/relationship-tags.js";
import { isRelationshipTagId } from "../in-memory/relationship-tags.js";
import { buildMoodDailyPromptPayload, moodDailyChoiceLine } from "../in-memory/pair-mood-prompts.js";
import {
  generateInviteCode,
  INVITE_TTL_MS,
  MAX_CHAT_BODY_CHARS,
  MAX_PAIR_MEMBERS,
  MAX_PAIRS_PER_USER,
  MAX_SOLO_BODY_CHARS,
  newId,
} from "../in-memory/pair-store-shared.js";
import { resolveAssistantReply } from "../../lib/chat-assistant-reply.js";
import {
  parseCalendarDayStrict,
  type ApproveMemberResult,
  type ApplyMoodDailyChoiceResult,
  type ChatMessageRow,
  type ChatRetentionChoice,
  type GetMoodDailyPromptResult,
  type GetMyMoodResult,
  type GetMyWhisperResult,
  type InviteLookupResult,
  type ListChatMessagesResult,
  type ListNotificationsResult,
  type ListPairMembersResult,
  type ListPendingMembersResult,
  type NotificationHistoryItem,
  type PairCreateResult,
  type PairMemberListItem,
  type PairMembershipState,
  type PairPrivacyResult,
  type PairSummaryForUser,
  type PostChatMessageResult,
  type RedeemInviteResult,
  type SaveMyMoodResult,
  type SaveMyWhisperResult,
  type SetActivePairResult,
  type WhisperSnapshot,
} from "../in-memory/pair-store-memory.js";

type PairDoc = {
  displayName: string;
  ownerUserId: string;
  relationshipTag: string;
  inviteCode: string;
  inviteExpiresAt: FirebaseFirestore.Timestamp;
  inviteConsumed: boolean;
};

type MemberDoc = {
  role: "owner" | "member";
  membershipState: PairMembershipState;
};

type UserMembershipDoc = {
  role: "owner" | "member";
  membershipState: PairMembershipState;
  displayName: string;
  relationshipTag: string;
  membershipCreatedAtMs: number;
};

function sortMembershipDocs<T extends { id: string }>(docs: T[], getMs: (d: T) => number): T[] {
  return [...docs].sort((a, b) => {
    const am = getMs(a);
    const bm = getMs(b);
    if (am !== bm) {
      return am - bm;
    }
    return a.id.localeCompare(b.id);
  });
}

function db() {
  return getFirestore();
}

function pairRef(pairId: string) {
  return db().collection("pairs").doc(pairId);
}

function inviteCodeRef(code: string) {
  return db().collection("pairInviteCodes").doc(code);
}

function userPrefsRef(userId: string) {
  return db().collection("users").doc(userId).collection("pairPrefs").doc("default");
}

function userMembershipRef(userId: string, pairId: string) {
  return db().collection("users").doc(userId).collection("pairMemberships").doc(pairId);
}

function userPairContextRef(userId: string, pairId: string) {
  return db().collection("users").doc(userId).collection("pairContexts").doc(pairId);
}

function moodDayRef(userId: string, pairId: string, dayKey: string) {
  return userPairContextRef(userId, pairId).collection("moodDays").doc(dayKey);
}

function whisperDayRef(userId: string, pairId: string, dayKey: string) {
  return userPairContextRef(userId, pairId).collection("whisperDays").doc(dayKey);
}

function notificationsCol(userId: string, pairId: string) {
  return userPairContextRef(userId, pairId).collection("notifications");
}

function chatMessagesCol(userId: string, pairId: string) {
  return userPairContextRef(userId, pairId).collection("chatMessages");
}

function asRelationshipTag(raw: string): RelationshipTagId | null {
  return isRelationshipTagId(raw) ? raw : null;
}

function pairDocToView(id: string, data: PairDoc): { id: string; displayName: string; ownerUserId: string; relationshipTag: RelationshipTagId } | null {
  const tag = asRelationshipTag(data.relationshipTag);
  if (tag === null) {
    return null;
  }
  return {
    id,
    displayName: data.displayName,
    ownerUserId: data.ownerUserId,
    relationshipTag: tag,
  };
}

async function readPair(pairId: string): Promise<{ id: string; displayName: string; ownerUserId: string; relationshipTag: RelationshipTagId } | null> {
  const snap = await pairRef(pairId).get();
  if (!snap.exists) {
    return null;
  }
  const v = pairDocToView(pairId, snap.data() as PairDoc);
  return v;
}

async function readMember(pairId: string, userId: string): Promise<MemberDoc | null> {
  const snap = await pairRef(pairId).collection("members").doc(userId).get();
  if (!snap.exists) {
    return null;
  }
  return snap.data() as MemberDoc;
}

async function isActiveMemberOfPair(userId: string, pairId: string): Promise<boolean> {
  const m = await readMember(pairId, userId);
  return m !== null && m.membershipState === "active";
}

async function countMembersForPair(pairId: string): Promise<number> {
  const snap = await pairRef(pairId).collection("members").get();
  return snap.size;
}

async function countUserPairs(userId: string): Promise<number> {
  const snap = await db().collection("users").doc(userId).collection("pairMemberships").get();
  return snap.size;
}

async function resolveActiveMembership(userId: string): Promise<{ pairId: string; role: "owner" | "member"; state: PairMembershipState } | null> {
  const prefsSnap = await userPrefsRef(userId).get();
  const preferred = prefsSnap.exists ? ((prefsSnap.data() as { activePairId?: string | null }).activePairId ?? null) : null;

  const memSnap = await db().collection("users").doc(userId).collection("pairMemberships").get();

  if (memSnap.empty) {
    return null;
  }

  const sorted = sortMembershipDocs(memSnap.docs, (d) => (d.data() as UserMembershipDoc).membershipCreatedAtMs ?? 0);
  const rows = sorted.map((d) => {
    const x = d.data() as UserMembershipDoc;
    return { pairId: d.id, role: x.role, state: x.membershipState };
  });

  if (preferred !== null && preferred !== undefined && preferred !== "") {
    const hit = rows.find((r) => r.pairId === preferred);
    if (hit !== undefined) {
      return hit;
    }
  }

  const first = rows[0]!;
  await userPrefsRef(userId).set({ activePairId: first.pairId }, { merge: true });
  return first;
}

function summaryFromParts(
  pair: { id: string; displayName: string; relationshipTag: RelationshipTagId },
  m: { pairId: string; role: "owner" | "member"; state: PairMembershipState },
): PairSummaryForUser {
  return {
    id: pair.id,
    displayName: pair.displayName,
    yourRole: m.role,
    membershipState: m.state,
    relationshipTag: pair.relationshipTag,
  };
}

export async function getPairSummaryForUser(userId: string): Promise<PairSummaryForUser | null> {
  const m = await resolveActiveMembership(userId);
  if (m === null) {
    return null;
  }
  const pair = await readPair(m.pairId);
  if (pair === null) {
    return null;
  }
  return summaryFromParts(pair, { pairId: m.pairId, role: m.role, state: m.state });
}

export async function listPairSummariesForUser(userId: string): Promise<PairSummaryForUser[]> {
  const memSnap = await db().collection("users").doc(userId).collection("pairMemberships").get();

  const out: PairSummaryForUser[] = [];
  for (const doc of sortMembershipDocs(memSnap.docs, (d) => (d.data() as UserMembershipDoc).membershipCreatedAtMs ?? 0)) {
    const x = doc.data() as UserMembershipDoc;
    const tag = asRelationshipTag(x.relationshipTag);
    if (tag === null) {
      continue;
    }
    out.push(
      summaryFromParts(
        { id: doc.id, displayName: x.displayName, relationshipTag: tag },
        { pairId: doc.id, role: x.role, state: x.membershipState },
      ),
    );
  }
  return out;
}

export async function setActivePairForUser(userId: string, pairId: string): Promise<SetActivePairResult> {
  const m = await readMember(pairId, userId);
  if (m === null) {
    return { ok: false, reason: "not_member" };
  }
  await userPrefsRef(userId).set({ activePairId: pairId }, { merge: true });
  return { ok: true };
}

export async function createOwnedPair(
  ownerUserId: string,
  input: { pairDisplayName: string; relationshipTag: RelationshipTagId },
): Promise<PairCreateResult> {
  if ((await countUserPairs(ownerUserId)) >= MAX_PAIRS_PER_USER) {
    return { ok: false, reason: "pairs_limit_reached" };
  }

  const pairId = newId("pair");
  const code = generateInviteCode();
  const expiresAtMs = Date.now() + INVITE_TTL_MS;
  const expiresTs = Timestamp.fromMillis(expiresAtMs);
  const batch = db().batch();
  const pRef = pairRef(pairId);

  batch.set(pRef, {
    displayName: input.pairDisplayName,
    ownerUserId,
    relationshipTag: input.relationshipTag,
    inviteCode: code,
    inviteExpiresAt: expiresTs,
    inviteConsumed: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  batch.set(pRef.collection("members").doc(ownerUserId), {
    role: "owner",
    membershipState: "active",
    updatedAt: FieldValue.serverTimestamp(),
  });

  batch.set(userMembershipRef(ownerUserId, pairId), {
    role: "owner",
    membershipState: "active",
    displayName: input.pairDisplayName,
    relationshipTag: input.relationshipTag,
    membershipCreatedAtMs: Date.now(),
  });

  batch.set(inviteCodeRef(code), {
    pairId,
    expiresAt: expiresTs,
    consumed: false,
  });

  batch.set(userPrefsRef(ownerUserId), { activePairId: pairId }, { merge: true });

  await batch.commit();

  await appendPairAuditLogSafe({
    pairId,
    type: "pair_created",
    actorUserId: ownerUserId,
    meta: { relationshipTag: input.relationshipTag },
  });

  return {
    ok: true,
    pairId,
    invite: { code, expiresAtIso: new Date(expiresAtMs).toISOString() },
  };
}

export async function redeemInviteCode(userId: string, rawCode: string): Promise<RedeemInviteResult> {
  const code = rawCode.trim();
  if (code === "") {
    return { ok: false, reason: "code_not_found" };
  }

  const result = await db().runTransaction(async (tx) => {
    const invSnap = await tx.get(inviteCodeRef(code));
    if (!invSnap.exists) {
      return { tag: "fail" as const, reason: "code_not_found" as const };
    }
    const invRow = invSnap.data() as { pairId: string; expiresAt: FirebaseFirestore.Timestamp; consumed: boolean };
    if (invRow.consumed || Date.now() > invRow.expiresAt.toMillis()) {
      return { tag: "fail" as const, reason: "invite_unusable" as const };
    }

    const pairSnap = await tx.get(pairRef(invRow.pairId));
    if (!pairSnap.exists) {
      return { tag: "fail" as const, reason: "code_not_found" as const };
    }
    const pair = pairDocToView(invRow.pairId, pairSnap.data() as PairDoc);
    if (pair === null) {
      return { tag: "fail" as const, reason: "code_not_found" as const };
    }

    if (pair.ownerUserId === userId) {
      return { tag: "fail" as const, reason: "cannot_join_own_pair" as const };
    }

    const existingMem = await tx.get(userMembershipRef(userId, invRow.pairId));
    if (existingMem.exists) {
      return { tag: "fail" as const, reason: "already_in_this_pair" as const };
    }

    const userMemQuery = db().collection("users").doc(userId).collection("pairMemberships");
    const userMemSnap = await tx.get(userMemQuery);
    if (userMemSnap.size >= MAX_PAIRS_PER_USER) {
      return { tag: "fail" as const, reason: "pairs_limit_for_user" as const };
    }

    const membersQuery = pairRef(invRow.pairId).collection("members");
    const membersSnap = await tx.get(membersQuery);
    if (membersSnap.size >= MAX_PAIR_MEMBERS) {
      return { tag: "fail" as const, reason: "pair_full" as const };
    }

    const pRef = pairRef(invRow.pairId);
    tx.update(pRef, {
      inviteConsumed: true,
    });
    tx.update(inviteCodeRef(code), { consumed: true });

    tx.set(pRef.collection("members").doc(userId), {
      role: "member",
      membershipState: "pending_owner_approval",
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(userMembershipRef(userId, invRow.pairId), {
      role: "member",
      membershipState: "pending_owner_approval",
      displayName: pair.displayName,
      relationshipTag: pair.relationshipTag,
      membershipCreatedAtMs: Date.now(),
    });

    tx.set(userPrefsRef(userId), { activePairId: invRow.pairId }, { merge: true });

    const summary = summaryFromParts(pair, {
      pairId: invRow.pairId,
      role: "member",
      state: "pending_owner_approval",
    });
    return { tag: "ok" as const, summary };
  });

  if (result.tag === "fail") {
    return { ok: false, reason: result.reason };
  }
  await appendPairAuditLogSafe({
    pairId: result.summary.id,
    type: "invite_redeemed",
    actorUserId: userId,
  });
  return { ok: true, pair: result.summary };
}

export async function listPendingMemberUserIdsForPair(pairId: string, actorUserId: string): Promise<ListPendingMembersResult> {
  const pair = await readPair(pairId);
  if (pair === null) {
    return { ok: false, reason: "not_found" };
  }
  if (pair.ownerUserId !== actorUserId) {
    return { ok: false, reason: "forbidden" };
  }
  const actorMem = await readMember(pairId, actorUserId);
  if (actorMem === null || actorMem.role !== "owner" || actorMem.membershipState !== "active") {
    return { ok: false, reason: "forbidden" };
  }

  const snap = await pairRef(pairId).collection("members").get();
  const userIds: string[] = [];
  for (const d of snap.docs) {
    const m = d.data() as MemberDoc;
    if (m.role === "member" && m.membershipState === "pending_owner_approval") {
      userIds.push(d.id);
    }
  }
  return { ok: true, userIds };
}

export async function approvePendingMember(actorUserId: string, pairId: string, memberUserId: string): Promise<ApproveMemberResult> {
  const pairSnap = await pairRef(pairId).get();
  if (!pairSnap.exists) {
    return { ok: false, reason: "not_found" };
  }
  const pair = pairSnap.data() as PairDoc;
  if (asRelationshipTag(pair.relationshipTag) === null) {
    return { ok: false, reason: "not_found" };
  }
  if (pair.ownerUserId !== actorUserId) {
    return { ok: false, reason: "forbidden" };
  }

  const actorMem = await readMember(pairId, actorUserId);
  if (actorMem === null || actorMem.role !== "owner" || actorMem.membershipState !== "active") {
    return { ok: false, reason: "forbidden" };
  }

  const targetMem = await readMember(pairId, memberUserId);
  if (targetMem === null) {
    return { ok: false, reason: "not_found" };
  }
  if (targetMem.role !== "member" || targetMem.membershipState !== "pending_owner_approval") {
    return { ok: false, reason: "not_pending" };
  }

  const oldCode = pair.inviteCode;

  await db().runTransaction(async (tx) => {
    const freshCode = generateInviteCode();
    const expiresAtMs = Date.now() + INVITE_TTL_MS;
    const expiresTs = Timestamp.fromMillis(expiresAtMs);

    const pRef = pairRef(pairId);
    tx.update(pRef, {
      inviteCode: freshCode,
      inviteExpiresAt: expiresTs,
      inviteConsumed: false,
    });

    if (oldCode !== freshCode) {
      tx.delete(inviteCodeRef(oldCode));
    }
    tx.set(inviteCodeRef(freshCode), {
      pairId,
      expiresAt: expiresTs,
      consumed: false,
    });

    tx.update(pRef.collection("members").doc(memberUserId), {
      membershipState: "active",
      updatedAt: FieldValue.serverTimestamp(),
    });

    const tag = asRelationshipTag(pair.relationshipTag)!;
    tx.set(
      userMembershipRef(memberUserId, pairId),
      {
        role: "member",
        membershipState: "active",
        displayName: pair.displayName,
        relationshipTag: tag,
      },
      { merge: true },
    );
  });

  await appendPairAuditLogSafe({
    pairId,
    type: "member_approved",
    actorUserId,
    subjectUserId: memberUserId,
  });

  return { ok: true };
}

export async function getActiveInviteForPairOwner(pairId: string, userId: string): Promise<InviteLookupResult> {
  const pairSnap = await pairRef(pairId).get();
  if (!pairSnap.exists) {
    return { ok: false, reason: "not_found" };
  }
  const pair = pairSnap.data() as PairDoc;
  if (pair.ownerUserId !== userId) {
    return { ok: false, reason: "forbidden" };
  }
  if (pair.inviteConsumed) {
    return { ok: false, reason: "consumed" };
  }
  if (Date.now() > pair.inviteExpiresAt.toMillis()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, code: pair.inviteCode, expiresAtIso: new Date(pair.inviteExpiresAt.toMillis()).toISOString() };
}

export async function listPairMembersForActor(actorUserId: string, pairId: string): Promise<ListPairMembersResult> {
  const pair = await readPair(pairId);
  if (pair === null) {
    return { ok: false, reason: "not_found" };
  }
  if (!(await isActiveMemberOfPair(actorUserId, pairId))) {
    return { ok: false, reason: "forbidden" };
  }
  const snap = await pairRef(pairId).collection("members").get();
  const members: PairMemberListItem[] = snap.docs.map((d) => {
    const m = d.data() as MemberDoc;
    return {
      userId: d.id,
      role: m.role,
      membershipState: m.membershipState,
    };
  });
  members.sort((a, b) => a.userId.localeCompare(b.userId));
  return { ok: true, members };
}

export async function getPairPrivacySettingsForActor(actorUserId: string, pairId: string): Promise<PairPrivacyResult> {
  const pair = await readPair(pairId);
  if (pair === null) {
    return { ok: false, reason: "not_found" };
  }
  if (!(await isActiveMemberOfPair(actorUserId, pairId))) {
    return { ok: false, reason: "forbidden" };
  }
  const ctx = await userPairContextRef(actorUserId, pairId).get();
  const stored = ctx.exists ? ((ctx.data() as { chatRetention?: ChatRetentionChoice }).chatRetention ?? undefined) : undefined;
  return { ok: true, chatRetention: stored ?? "30days" };
}

export async function setPairPrivacySettingsForActor(
  actorUserId: string,
  pairId: string,
  chatRetention: ChatRetentionChoice,
): Promise<PairPrivacyResult> {
  const pair = await readPair(pairId);
  if (pair === null) {
    return { ok: false, reason: "not_found" };
  }
  if (!(await isActiveMemberOfPair(actorUserId, pairId))) {
    return { ok: false, reason: "forbidden" };
  }
  await userPairContextRef(actorUserId, pairId).set({ chatRetention }, { merge: true });
  return { ok: true, chatRetention };
}

export async function getMoodDailyPromptForActor(actorUserId: string, pairId: string, dayKey: string): Promise<GetMoodDailyPromptResult> {
  const pair = await readPair(pairId);
  if (pair === null) {
    return { ok: false, reason: "not_found" };
  }
  if (!(await isActiveMemberOfPair(actorUserId, pairId))) {
    return { ok: false, reason: "forbidden" };
  }
  if (parseCalendarDayStrict(dayKey) === null) {
    return { ok: false, reason: "validation_error" };
  }
  const payload = buildMoodDailyPromptPayload(dayKey, pairId);
  return { ok: true, dayKey, ...payload };
}

export async function applyMoodDailyChoiceForActor(
  actorUserId: string,
  pairId: string,
  dayKey: string,
  choiceId: string,
): Promise<ApplyMoodDailyChoiceResult> {
  const pair = await readPair(pairId);
  if (pair === null) {
    return { ok: false, reason: "not_found" };
  }
  if (!(await isActiveMemberOfPair(actorUserId, pairId))) {
    return { ok: false, reason: "forbidden" };
  }
  if (parseCalendarDayStrict(dayKey) === null) {
    return { ok: false, reason: "validation_error" };
  }
  const line = moodDailyChoiceLine(dayKey, pairId, choiceId);
  if (line === null) {
    return { ok: false, reason: "validation_error" };
  }

  const ctxRef = userPairContextRef(actorUserId, pairId);
  const dayRef = moodDayRef(actorUserId, pairId, dayKey);

  try {
    const merged = await db().runTransaction(async (tx) => {
      const ctxSnap = await tx.get(ctxRef);
      const legacy = ctxSnap.exists ? (ctxSnap.data() as { moodLegacyBody?: string }) : {};
      const daySnap = await tx.get(dayRef);
      let body = daySnap.exists ? ((daySnap.data() as { body: string }).body ?? "") : "";
      if (body === "" && legacy.moodLegacyBody !== undefined && legacy.moodLegacyBody !== "") {
        body = legacy.moodLegacyBody;
        tx.update(ctxRef, { moodLegacyBody: FieldValue.delete(), moodLegacySavedAt: FieldValue.delete() });
      }
      const out = body.trim() === "" ? line : `${body.trimEnd()}\n${line}`;
      if (out.length > MAX_SOLO_BODY_CHARS) {
        throw new Error("too_long");
      }
      const savedAtIso = new Date().toISOString();
      tx.set(dayRef, { body: out, savedAtIso }, { merge: true });
      return { body: out, savedAtIso };
    });
    return { ok: true, mood: { date: dayKey, body: merged.body, savedAt: merged.savedAtIso } };
  } catch {
    return { ok: false, reason: "validation_error" };
  }
}

export async function getMyMoodForPair(actorUserId: string, pairId: string, dayKey: string): Promise<GetMyMoodResult> {
  const pair = await readPair(pairId);
  if (pair === null) {
    return { ok: false, reason: "not_found" };
  }
  if (!(await isActiveMemberOfPair(actorUserId, pairId))) {
    return { ok: false, reason: "forbidden" };
  }
  const ctxRef = userPairContextRef(actorUserId, pairId);
  const dayRef = moodDayRef(actorUserId, pairId, dayKey);
  const daySnap = await dayRef.get();
  if (daySnap.exists) {
    const row = daySnap.data() as { body: string; savedAtIso: string };
    return { ok: true, dayKey, mood: { date: dayKey, body: row.body, savedAt: row.savedAtIso } };
  }
  const ctxSnap = await ctxRef.get();
  const legacy = ctxSnap.exists ? (ctxSnap.data() as { moodLegacyBody?: string; moodLegacySavedAt?: string }) : {};
  if (legacy.moodLegacyBody !== undefined && legacy.moodLegacyBody !== "") {
    const savedAtIso = legacy.moodLegacySavedAt ?? new Date().toISOString();
    await db().runTransaction(async (tx) => {
      tx.set(dayRef, { body: legacy.moodLegacyBody, savedAtIso }, { merge: true });
      tx.update(ctxRef, { moodLegacyBody: FieldValue.delete(), moodLegacySavedAt: FieldValue.delete() });
    });
    return { ok: true, dayKey, mood: { date: dayKey, body: legacy.moodLegacyBody, savedAt: savedAtIso } };
  }
  return { ok: true, dayKey, mood: null };
}

export async function saveMyMoodForPair(
  actorUserId: string,
  pairId: string,
  dayKey: string,
  body: string,
): Promise<SaveMyMoodResult> {
  const pair = await readPair(pairId);
  if (pair === null) {
    return { ok: false, reason: "not_found" };
  }
  if (!(await isActiveMemberOfPair(actorUserId, pairId))) {
    return { ok: false, reason: "forbidden" };
  }
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "validation_error" };
  }
  if (trimmed.length > MAX_SOLO_BODY_CHARS) {
    return { ok: false, reason: "validation_error" };
  }
  const savedAtIso = new Date().toISOString();
  await moodDayRef(actorUserId, pairId, dayKey).set({ body: trimmed, savedAtIso }, { merge: true });
  return { ok: true, mood: { date: dayKey, body: trimmed, savedAt: savedAtIso } };
}

export async function getMyWhisperForPair(actorUserId: string, pairId: string, dayKey: string): Promise<GetMyWhisperResult> {
  const pair = await readPair(pairId);
  if (pair === null) {
    return { ok: false, reason: "not_found" };
  }
  if (!(await isActiveMemberOfPair(actorUserId, pairId))) {
    return { ok: false, reason: "forbidden" };
  }
  const ctxRef = userPairContextRef(actorUserId, pairId);
  const dayRef = whisperDayRef(actorUserId, pairId, dayKey);
  const daySnap = await dayRef.get();
  if (daySnap.exists) {
    const row = daySnap.data() as { body: string; savedAtIso: string };
    return { ok: true, dayKey, whisper: { date: dayKey, body: row.body, savedAt: row.savedAtIso } };
  }
  const ctxSnap = await ctxRef.get();
  const legacy = ctxSnap.exists ? (ctxSnap.data() as { whisperLegacyBody?: string; whisperLegacySavedAt?: string }) : {};
  if (legacy.whisperLegacyBody !== undefined && legacy.whisperLegacyBody !== "") {
    const savedAtIso = legacy.whisperLegacySavedAt ?? new Date().toISOString();
    await db().runTransaction(async (tx) => {
      tx.set(dayRef, { body: legacy.whisperLegacyBody, savedAtIso }, { merge: true });
      tx.update(ctxRef, { whisperLegacyBody: FieldValue.delete(), whisperLegacySavedAt: FieldValue.delete() });
    });
    return { ok: true, dayKey, whisper: { date: dayKey, body: legacy.whisperLegacyBody, savedAt: savedAtIso } };
  }
  return { ok: true, dayKey, whisper: null };
}

export async function saveMyWhisperForPair(
  actorUserId: string,
  pairId: string,
  dayKey: string,
  body: string,
): Promise<SaveMyWhisperResult> {
  const pair = await readPair(pairId);
  if (pair === null) {
    return { ok: false, reason: "not_found" };
  }
  if (!(await isActiveMemberOfPair(actorUserId, pairId))) {
    return { ok: false, reason: "forbidden" };
  }
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "validation_error" };
  }
  if (trimmed.length > MAX_SOLO_BODY_CHARS) {
    return { ok: false, reason: "validation_error" };
  }
  const savedAtIso = new Date().toISOString();
  await whisperDayRef(actorUserId, pairId, dayKey).set({ body: trimmed, savedAtIso }, { merge: true });
  return { ok: true, whisper: { date: dayKey, body: trimmed, savedAt: savedAtIso } };
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

function deterministicSeedNotifications(pairId: string, displayName: string): NotificationHistoryItem[] {
  const label = displayName || "このペア";
  let checksum = 0;
  for (let i = 0; i < pairId.length; i += 1) {
    checksum += pairId.charCodeAt(i)!;
  }
  const branch = (checksum + label.length) % 2;
  const now = Date.now();
  const msDay = 86400000;
  const jitterMs = (checksum % 6) * 3600000;
  if (branch === 0) {
    return [
      {
        id: "seed_ntf_a",
        headline: "朝のかたち",
        body: `「${label}」は、いまは静かな一日のはじまりに近いようです。受け取り方は、あなたの手に残します。`,
        createdAt: new Date(now - msDay * 2 - jitterMs).toISOString(),
      },
      {
        id: "seed_ntf_b",
        headline: "日中の気配",
        body: `「${label}」について、目立つ変化がなくても、空気の重さだけが少し違う、ということもあります。`,
        createdAt: new Date(now - msDay * 1 - jitterMs).toISOString(),
      },
    ];
  }
  return [
    {
      id: "seed_ntf_a",
      headline: "夕方の輪郭",
      body: `「${label}」のまわりは、今日も穏やかに畳まれていきそうです。急がなくて大丈夫です。`,
      createdAt: new Date(now - msDay * 3 - jitterMs).toISOString(),
    },
    {
      id: "seed_ntf_b",
      headline: "夜に向けて",
      body: `「${label}」について、いまは推察を増やさないほうが、落ち着きやすいかもしれません。`,
      createdAt: new Date(now - msDay * 1 - jitterMs).toISOString(),
    },
  ];
}

export async function listNotificationsForActor(actorUserId: string, pairId: string): Promise<ListNotificationsResult> {
  const pair = await readPair(pairId);
  if (pair === null) {
    return { ok: false, reason: "not_found" };
  }
  if (!(await isActiveMemberOfPair(actorUserId, pairId))) {
    return { ok: false, reason: "forbidden" };
  }
  const col = notificationsCol(actorUserId, pairId);
  const snap = await col.get();
  const existingIds = new Set(snap.docs.map((d) => d.id));
  const seeds = deterministicSeedNotifications(pairId, pair.displayName);
  const missingSeeds = seeds.filter((s) => !existingIds.has(s.id));
  if (missingSeeds.length > 0) {
    const batch = db().batch();
    for (const s of missingSeeds) {
      batch.set(col.doc(s.id), { headline: s.headline, body: s.body, createdAt: s.createdAt }, { merge: true });
    }
    await batch.commit();
  }
  const all = await col.get();
  const notifications: NotificationHistoryItem[] = all.docs.map((d) => {
    const x = d.data() as { headline: string; body: string; createdAt: string };
    return { id: d.id, headline: x.headline, body: x.body, createdAt: x.createdAt };
  });
  notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { ok: true, notifications };
}

async function activeMemberUserIdsForPair(pairId: string): Promise<Set<string>> {
  const snap = await pairRef(pairId).collection("members").get();
  const ids = new Set<string>();
  for (const d of snap.docs) {
    const m = d.data() as MemberDoc;
    if (m.membershipState === "active") {
      ids.add(d.id);
    }
  }
  return ids;
}

export async function listChatMessagesForActor(actorUserId: string, pairId: string): Promise<ListChatMessagesResult> {
  const pair = await readPair(pairId);
  if (pair === null) {
    return { ok: false, reason: "not_found" };
  }
  if (!(await isActiveMemberOfPair(actorUserId, pairId))) {
    return { ok: false, reason: "forbidden" };
  }
  const priv = await getPairPrivacySettingsForActor(actorUserId, pairId);
  if (!priv.ok) {
    return { ok: false, reason: "not_found" };
  }
  const cutoff = retentionCutoffMs(priv.chatRetention);
  const col = chatMessagesCol(actorUserId, pairId);
  const snap = await col.get();
  const raw: ChatMessageRow[] = snap.docs.map((d) => {
    const m = d.data() as {
      role: ChatMessageRow["role"];
      body: string;
      createdAt: string;
      topicUserId?: string | null;
    };
    return {
      id: d.id,
      role: m.role,
      body: m.body,
      createdAt: m.createdAt,
      topicUserId: m.topicUserId ?? null,
    };
  });
  raw.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const messages = raw.filter((m) => new Date(m.createdAt).getTime() >= cutoff);
  return { ok: true, messages };
}

export async function postChatMessageForActor(
  actorUserId: string,
  pairId: string,
  text: string,
  topicUserId: string | null,
): Promise<PostChatMessageResult> {
  const pair = await readPair(pairId);
  if (pair === null) {
    return { ok: false, reason: "not_found" };
  }
  if (!(await isActiveMemberOfPair(actorUserId, pairId))) {
    return { ok: false, reason: "forbidden" };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "validation_error" };
  }
  if (trimmed.length > MAX_CHAT_BODY_CHARS) {
    return { ok: false, reason: "validation_error" };
  }
  const members = await activeMemberUserIdsForPair(pairId);
  let topic: string | null = topicUserId;
  if (topic !== null && topic !== "") {
    if (!members.has(topic)) {
      return { ok: false, reason: "bad_topic" };
    }
  } else {
    topic = null;
  }

  const col = chatMessagesCol(actorUserId, pairId);
  const nowIso = new Date().toISOString();
  const userMsgId = newId("cht");
  const asstMsgId = newId("cht");
  const assistantBody = await resolveAssistantReply(trimmed, topic);
  const batch = db().batch();
  batch.set(col.doc(userMsgId), {
    role: "user" as const,
    body: trimmed,
    createdAt: nowIso,
    topicUserId: topic,
  });
  batch.set(col.doc(asstMsgId), {
    role: "assistant" as const,
    body: assistantBody,
    createdAt: nowIso,
    topicUserId: topic,
  });
  await batch.commit();

  const listed = await listChatMessagesForActor(actorUserId, pairId);
  if (!listed.ok) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true, messages: listed.messages };
}
