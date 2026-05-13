import { beforeEach, describe, expect, it } from "vitest";
import {
  createOwnedPair,
  getActiveInviteForPairOwner,
  getPairSummaryForUser,
  redeemInviteCode,
  resetInMemoryPairStateForTests,
} from "./pair-store.js";

describe("pair-store", () => {
  beforeEach(() => {
    resetInMemoryPairStateForTests();
  });

  it("初期状態では所属がない", () => {
    expect(getPairSummaryForUser("user-owner-01")).toBeNull();
  });

  it("ペア作成後、オーナーとして要約が取れる", () => {
    const created = createOwnedPair("user-owner-01", {
      pairDisplayName: "わが家",
      relationshipTag: "family",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const summary = getPairSummaryForUser("user-owner-01");
    expect(summary).not.toBeNull();
    expect(summary?.displayName).toBe("わが家");
    expect(summary?.yourRole).toBe("owner");
    expect(summary?.relationshipTag).toBe("family");

    const inv = getActiveInviteForPairOwner(created.pairId, "user-owner-01");
    expect(inv.ok).toBe(true);
    if (!inv.ok) {
      return;
    }
    expect(inv.code.length).toBeGreaterThanOrEqual(8);
  });

  it("二重作成は拒否される", () => {
    createOwnedPair("user-owner-01", {
      pairDisplayName: "いち",
      relationshipTag: "friends",
    });
    const second = createOwnedPair("user-owner-01", {
      pairDisplayName: "に",
      relationshipTag: "friends",
    });
    expect(second.ok).toBe(false);
    if (second.ok) {
      return;
    }
    expect(second.reason).toBe("already_in_pair");
  });

  it("招待コードで参加すると、承認待ちになる", () => {
    const created = createOwnedPair("user-owner-01", {
      pairDisplayName: "わが家",
      relationshipTag: "family",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const inv = getActiveInviteForPairOwner(created.pairId, "user-owner-01");
    expect(inv.ok).toBe(true);
    if (!inv.ok) {
      return;
    }

    const redeemed = redeemInviteCode("user-member-02", inv.code);
    expect(redeemed.ok).toBe(true);
    if (!redeemed.ok) {
      return;
    }
    expect(redeemed.pair.membershipState).toBe("pending_owner_approval");
    expect(redeemed.pair.yourRole).toBe("member");

    const memberSummary = getPairSummaryForUser("user-member-02");
    expect(memberSummary?.membershipState).toBe("pending_owner_approval");
  });

  it("オーナーは自分の招待コードを使えない", () => {
    const created = createOwnedPair("user-owner-01", {
      pairDisplayName: "わが家",
      relationshipTag: "family",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const inv = getActiveInviteForPairOwner(created.pairId, "user-owner-01");
    expect(inv.ok).toBe(true);
    if (!inv.ok) {
      return;
    }

    const redeemed = redeemInviteCode("user-owner-01", inv.code);
    expect(redeemed.ok).toBe(false);
    if (redeemed.ok) {
      return;
    }
    expect(redeemed.reason).toBe("cannot_join_own_pair");
  });
});
