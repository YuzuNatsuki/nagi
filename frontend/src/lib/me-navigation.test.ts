import { describe, expect, it } from "vitest";
import { routeAfterMe } from "./me-navigation.js";

describe("routeAfterMe", () => {
  it("ペア未所属ははじまりへ", () => {
    expect(
      routeAfterMe({
        user: { id: "u1", displayName: "a", nickname: null, authDisplayName: "a" },
        pair: null,
      }),
    ).toBe("/onboarding");
  });

  it("承認待ちは承認待ち画面へ", () => {
    expect(
      routeAfterMe({
        user: { id: "u1", displayName: "a", nickname: null, authDisplayName: "a" },
        pair: {
          id: "p1",
          displayName: "x",
          yourRole: "member",
          membershipState: "pending_owner_approval",
          relationshipTag: "family",
        },
      }),
    ).toBe("/onboarding/pending-approval");
  });

  it("アクティブは凪の入口へ", () => {
    expect(
      routeAfterMe({
        user: { id: "u1", displayName: "a", nickname: null, authDisplayName: "a" },
        pair: {
          id: "p1",
          displayName: "x",
          yourRole: "owner",
          membershipState: "active",
          relationshipTag: "family",
        },
      }),
    ).toBe("/app");
  });
});
