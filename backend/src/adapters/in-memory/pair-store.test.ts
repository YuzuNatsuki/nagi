import { beforeEach, describe, expect, it } from "vitest";
import {
  applyMoodDailyChoiceForActor,
  approvePendingMember,
  buildMoodDailyPromptPayload,
  createOwnedPair,
  getActiveInviteForPairOwner,
  getMyMoodForPair,
  getMyWhisperForPair,
  getPairPrivacySettingsForActor,
  getPairSummaryForUser,
  listChatMessagesForActor,
  listPairMembersForActor,
  listNotificationsForActor,
  listPairSummariesForUser,
  listPendingMemberUserIdsForPair,
  parseCalendarDayStrict,
  postChatMessageForActor,
  redeemInviteCode,
  resetInMemoryPairStateForTests,
  saveMyMoodForPair,
  saveMyWhisperForPair,
  setActivePairForUser,
  setPairPrivacySettingsForActor,
} from "./pair-store.js";

describe("pair-store", () => {
  /** テスト用の固定暦日（Mood / Whisper のキー） */
  const D = "2030-06-15";

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

  it("同じオーナーで複数ペアを作れる", () => {
    const first = createOwnedPair("user-owner-01", {
      pairDisplayName: "いち",
      relationshipTag: "friends",
    });
    expect(first.ok).toBe(true);
    const second = createOwnedPair("user-owner-01", {
      pairDisplayName: "に",
      relationshipTag: "family",
    });
    expect(second.ok).toBe(true);
    expect(listPairSummariesForUser("user-owner-01")).toHaveLength(2);
    expect(getPairSummaryForUser("user-owner-01")?.displayName).toBe("に");
  });

  it("所属ペアが上限のとき、新規作成は拒否される", () => {
    for (let i = 0; i < 4; i += 1) {
      const r = createOwnedPair("user-owner-01", {
        pairDisplayName: `p${i}`,
        relationshipTag: "friends",
      });
      expect(r.ok).toBe(true);
    }
    const fifth = createOwnedPair("user-owner-01", {
      pairDisplayName: "full",
      relationshipTag: "friends",
    });
    expect(fifth.ok).toBe(false);
    if (fifth.ok) {
      return;
    }
    expect(fifth.reason).toBe("pairs_limit_reached");
  });

  it("アクティブなペアを切り替えられる", () => {
    const a = createOwnedPair("user-owner-01", {
      pairDisplayName: "いち",
      relationshipTag: "family",
    });
    expect(a.ok).toBe(true);
    if (!a.ok) {
      return;
    }
    const b = createOwnedPair("user-owner-01", {
      pairDisplayName: "に",
      relationshipTag: "family",
    });
    expect(b.ok).toBe(true);
    if (!b.ok) {
      return;
    }
    expect(getPairSummaryForUser("user-owner-01")?.displayName).toBe("に");
    expect(setActivePairForUser("user-owner-01", a.pairId)).toEqual({ ok: true });
    expect(getPairSummaryForUser("user-owner-01")?.displayName).toBe("いち");
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

  it("オーナーが承認すると、メンバーはアクティブになり、招待が再発行される", () => {
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

    const pending = listPendingMemberUserIdsForPair(created.pairId, "user-owner-01");
    expect(pending.ok).toBe(true);
    if (!pending.ok) {
      return;
    }
    expect(pending.userIds).toContain("user-member-02");

    const approved = approvePendingMember("user-owner-01", created.pairId, "user-member-02");
    expect(approved.ok).toBe(true);

    const memberSummary = getPairSummaryForUser("user-member-02");
    expect(memberSummary?.membershipState).toBe("active");

    const inv2 = getActiveInviteForPairOwner(created.pairId, "user-owner-01");
    expect(inv2.ok).toBe(true);
    if (!inv2.ok) {
      return;
    }
    expect(inv2.code).not.toBe(inv.code);
  });

  it("参加済みの人だけが、メンバー一覧を読める", () => {
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

    const beforeApprove = listPairMembersForActor("user-member-02", created.pairId);
    expect(beforeApprove.ok).toBe(false);
    if (beforeApprove.ok) {
      return;
    }
    expect(beforeApprove.reason).toBe("forbidden");

    const approved = approvePendingMember("user-owner-01", created.pairId, "user-member-02");
    expect(approved.ok).toBe(true);

    const forMember = listPairMembersForActor("user-member-02", created.pairId);
    expect(forMember.ok).toBe(true);
    if (!forMember.ok) {
      return;
    }
    expect(forMember.members).toHaveLength(2);

    const forOwner = listPairMembersForActor("user-owner-01", created.pairId);
    expect(forOwner.ok).toBe(true);
    if (!forOwner.ok) {
      return;
    }
    expect(forOwner.members.map((m) => m.userId).sort()).toEqual(["user-member-02", "user-owner-01"]);
  });

  it("チャット履歴の保持は既定が30日で、本人だけが書き換えられる", () => {
    const created = createOwnedPair("user-owner-01", {
      pairDisplayName: "わが家",
      relationshipTag: "family",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const initial = getPairPrivacySettingsForActor("user-owner-01", created.pairId);
    expect(initial.ok).toBe(true);
    if (!initial.ok) {
      return;
    }
    expect(initial.chatRetention).toBe("30days");

    const saved = setPairPrivacySettingsForActor("user-owner-01", created.pairId, "none");
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }
    expect(saved.chatRetention).toBe("none");

    const again = getPairPrivacySettingsForActor("user-owner-01", created.pairId);
    expect(again.ok).toBe(true);
    if (!again.ok) {
      return;
    }
    expect(again.chatRetention).toBe("none");
  });

  it("暦日の検証は、存在しない日付を弾く", () => {
    expect(parseCalendarDayStrict("2026-02-30")).toBeNull();
    expect(parseCalendarDayStrict("2026-02-01")).toBe("2026-02-01");
  });

  it("今日のメモの質問への回答は、追記として残る", () => {
    const created = createOwnedPair("user-owner-01", {
      pairDisplayName: "わが家",
      relationshipTag: "family",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const day = "2030-08-20";
    const prompt = buildMoodDailyPromptPayload(day, created.pairId);
    expect(prompt.choices.length).toBeGreaterThan(0);
    const first = applyMoodDailyChoiceForActor("user-owner-01", created.pairId, day, prompt.choices[0]!.id);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.mood.body.length).toBeGreaterThan(0);
    const second = applyMoodDailyChoiceForActor("user-owner-01", created.pairId, day, prompt.choices[1]!.id);
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.mood.body.includes("\n")).toBe(true);
    expect(applyMoodDailyChoiceForActor("user-owner-01", created.pairId, day, "99").ok).toBe(false);
  });

  it("Mood は日ごとに別々に保存される", () => {
    const created = createOwnedPair("user-owner-01", {
      pairDisplayName: "わが家",
      relationshipTag: "family",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const a = saveMyMoodForPair("user-owner-01", created.pairId, "2030-01-01", "元日の一行");
    const b = saveMyMoodForPair("user-owner-01", created.pairId, "2030-01-02", "翌日の一行");
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    const g1 = getMyMoodForPair("user-owner-01", created.pairId, "2030-01-01");
    const g2 = getMyMoodForPair("user-owner-01", created.pairId, "2030-01-02");
    expect(g1.ok).toBe(true);
    expect(g2.ok).toBe(true);
    if (!g1.ok || !g2.ok) {
      return;
    }
    expect(g1.mood?.body).toBe("元日の一行");
    expect(g2.mood?.body).toBe("翌日の一行");
    expect(g1.mood?.date).toBe("2030-01-01");
  });

  it("Mood は参加済みの本人だけが読み書きでき、ほかの人からは見えない", () => {
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

    const pendingRead = getMyMoodForPair("user-member-02", created.pairId, D);
    expect(pendingRead.ok).toBe(false);

    const approved = approvePendingMember("user-owner-01", created.pairId, "user-member-02");
    expect(approved.ok).toBe(true);

    const empty = getMyMoodForPair("user-member-02", created.pairId, D);
    expect(empty.ok).toBe(true);
    if (!empty.ok) {
      return;
    }
    expect(empty.mood).toBeNull();

    const saved = saveMyMoodForPair("user-member-02", created.pairId, D, "  ふつう  ");
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }
    expect(saved.mood.body).toBe("ふつう");

    const ownerView = getMyMoodForPair("user-owner-01", created.pairId, D);
    expect(ownerView.ok).toBe(true);
    if (!ownerView.ok) {
      return;
    }
    expect(ownerView.mood).toBeNull();

    const memberAgain = getMyMoodForPair("user-member-02", created.pairId, D);
    expect(memberAgain.ok).toBe(true);
    if (!memberAgain.ok) {
      return;
    }
    expect(memberAgain.mood?.body).toBe("ふつう");
  });

  it("空の Mood は保存できない", () => {
    const created = createOwnedPair("user-owner-01", {
      pairDisplayName: "わが家",
      relationshipTag: "family",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const r = saveMyMoodForPair("user-owner-01", created.pairId, D, "   ");
    expect(r.ok).toBe(false);
  });

  it("Whisper は Mood とは別に、本人だけが読み書きできる", () => {
    const created = createOwnedPair("user-owner-01", {
      pairDisplayName: "わが家",
      relationshipTag: "family",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const moodSaved = saveMyMoodForPair("user-owner-01", created.pairId, D, "気分のほう");
    expect(moodSaved.ok).toBe(true);
    const whisperSaved = saveMyWhisperForPair("user-owner-01", created.pairId, D, "こえにならないほう");
    expect(whisperSaved.ok).toBe(true);

    const m = getMyMoodForPair("user-owner-01", created.pairId, D);
    expect(m.ok).toBe(true);
    if (!m.ok) {
      return;
    }
    expect(m.mood?.body).toBe("気分のほう");

    const w = getMyWhisperForPair("user-owner-01", created.pairId, D);
    expect(w.ok).toBe(true);
    if (!w.ok) {
      return;
    }
    expect(w.whisper?.body).toBe("こえにならないほう");
  });

  it("Whisper も日ごとに別々に保存される", () => {
    const created = createOwnedPair("user-owner-01", {
      pairDisplayName: "わが家",
      relationshipTag: "family",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(saveMyWhisperForPair("user-owner-01", created.pairId, "2030-03-01", "三月一日").ok).toBe(true);
    expect(saveMyWhisperForPair("user-owner-01", created.pairId, "2030-03-02", "三月二日").ok).toBe(true);
    const w1 = getMyWhisperForPair("user-owner-01", created.pairId, "2030-03-01");
    const w2 = getMyWhisperForPair("user-owner-01", created.pairId, "2030-03-02");
    expect(w1.ok && w2.ok).toBe(true);
    if (!w1.ok || !w2.ok) {
      return;
    }
    expect(w1.whisper?.body).toBe("三月一日");
    expect(w2.whisper?.body).toBe("三月二日");
  });

  it("空の Whisper は保存できない", () => {
    const created = createOwnedPair("user-owner-01", {
      pairDisplayName: "わが家",
      relationshipTag: "family",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const r = saveMyWhisperForPair("user-owner-01", created.pairId, D, "   ");
    expect(r.ok).toBe(false);
  });

  it("参加済みの人だけが、通知履歴を読める", () => {
    const created = createOwnedPair("user-owner-01", {
      pairDisplayName: "わが家",
      relationshipTag: "family",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const forOwner = listNotificationsForActor("user-owner-01", created.pairId);
    expect(forOwner.ok).toBe(true);
    if (!forOwner.ok) {
      return;
    }
    expect(forOwner.notifications.length).toBeGreaterThanOrEqual(2);

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

    const pendingList = listNotificationsForActor("user-member-02", created.pairId);
    expect(pendingList.ok).toBe(false);
  });

  it("凪に話すはアクティブな人だけが読み書きでき、応答が返る", () => {
    const created = createOwnedPair("user-owner-01", {
      pairDisplayName: "わが家",
      relationshipTag: "family",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const empty = listChatMessagesForActor("user-owner-01", created.pairId);
    expect(empty.ok).toBe(true);
    if (!empty.ok) {
      return;
    }
    expect(empty.messages).toHaveLength(0);

    const posted = postChatMessageForActor("user-owner-01", created.pairId, "今日は疲れた", null);
    expect(posted.ok).toBe(true);
    if (!posted.ok) {
      return;
    }
    expect(posted.messages).toHaveLength(2);
    expect(posted.messages[0]?.role).toBe("user");
    expect(posted.messages[1]?.role).toBe("assistant");
    expect(posted.messages[1]?.body).toContain("休める");

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

    const pendingPost = postChatMessageForActor("user-member-02", created.pairId, "こんにちは", null);
    expect(pendingPost.ok).toBe(false);
    if (pendingPost.ok) {
      return;
    }
    expect(pendingPost.reason).toBe("forbidden");

    const approved = approvePendingMember("user-owner-01", created.pairId, "user-member-02");
    expect(approved.ok).toBe(true);

    const memberPost = postChatMessageForActor("user-member-02", created.pairId, "ありがとう", null);
    expect(memberPost.ok).toBe(true);
    if (!memberPost.ok) {
      return;
    }
    expect(memberPost.messages.some((m) => m.role === "assistant" && m.body.includes("やわらかい"))).toBe(
      true,
    );
  });

  it("話題にする人は、アクティブメンバーに限る", () => {
    const created = createOwnedPair("user-owner-01", {
      pairDisplayName: "わが家",
      relationshipTag: "family",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const bad = postChatMessageForActor("user-owner-01", created.pairId, "こんにちは", "user-ghost");
    expect(bad.ok).toBe(false);
    if (bad.ok) {
      return;
    }
    expect(bad.reason).toBe("bad_topic");
  });
});
