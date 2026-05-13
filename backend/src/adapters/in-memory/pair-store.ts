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
  | { ok: false; reason: "already_in_pair" };

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
const memberships = new Map<string, MembershipRecord>();
const invitesByPairId = new Map<string, InviteRecord>();

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const INVITE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const MAX_PAIR_MEMBERS = 4;

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

/** 単体テスト用。本番コードからは呼ばない。 */
export function resetInMemoryPairStateForTests(): void {
  pairs.clear();
  memberships.clear();
  invitesByPairId.clear();
}

function countMembersForPair(pairId: string): number {
  let n = 0;
  for (const m of memberships.values()) {
    if (m.pairId === pairId) {
      n += 1;
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

export type RedeemInviteResult =
  | { ok: true; pair: PairSummaryForUser }
  | {
      ok: false;
      reason:
        | "already_in_pair"
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

  if (memberships.has(userId)) {
    return { ok: false, reason: "already_in_pair" };
  }

  if (countMembersForPair(inv.pairId) >= MAX_PAIR_MEMBERS) {
    return { ok: false, reason: "pair_full" };
  }

  inv.consumed = true;

  memberships.set(userId, {
    pairId: inv.pairId,
    role: "member",
    state: "pending_owner_approval",
  });

  const summary = getPairSummaryForUser(userId);
  if (summary === null) {
    return { ok: false, reason: "code_not_found" };
  }

  return { ok: true, pair: summary };
}

export function getPairSummaryForUser(userId: string): PairSummaryForUser | null {
  const m = memberships.get(userId);
  if (m === undefined) {
    return null;
  }
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

export function createOwnedPair(
  ownerUserId: string,
  input: { pairDisplayName: string; relationshipTag: RelationshipTagId },
): PairCreateResult {
  if (memberships.has(ownerUserId)) {
    return { ok: false, reason: "already_in_pair" };
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

  memberships.set(ownerUserId, {
    pairId,
    role: "owner",
    state: "active",
  });

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
