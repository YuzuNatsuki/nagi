import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

let stubRedeemPendingPair = false;

afterEach(() => {
  stubRedeemPendingPair = false;
  cleanup();
});

/** happy-dom では Vite プロキシが無いため、相対 `/api` が誤接続しないよう既定でスタブする */
vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("/api/dev/dummy-users")) {
      return new Response(JSON.stringify({ users: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/api/me")) {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      const pair =
        stubRedeemPendingPair
          ? {
              id: "pair_test",
              displayName: "てすと",
              yourRole: "member" as const,
              membershipState: "pending_owner_approval" as const,
              relationshipTag: "family" as const,
            }
          : null;

      return new Response(
        JSON.stringify({
          user: { id: hasUser, displayName: "テスト" },
          pair,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/api/invites/redeem") && method === "POST") {
      stubRedeemPendingPair = true;
      return new Response(
        JSON.stringify({
          pair: {
            id: "pair_test",
            displayName: "てすと",
            yourRole: "member",
            membershipState: "pending_owner_approval",
            relationshipTag: "family",
          },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/api/pairs") && !url.includes("/invite") && method === "POST") {
      return new Response(
        JSON.stringify({
          pair: {
            id: "pair_test",
            displayName: "てすと",
            yourRole: "owner",
            membershipState: "active",
            relationshipTag: "family",
          },
          invite: {
            code: "abcdABCD2345",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/api/pairs/") && url.includes("/invite") && method === "GET") {
      return new Response(
        JSON.stringify({
          code: "abcdABCD2345",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response("not found", { status: 404 });
  }),
);
