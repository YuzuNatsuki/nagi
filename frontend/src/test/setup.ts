import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

let stubRedeemPendingPair = false;
/** 画面遷移テスト用: `/api/me` などにアクティブなペアを返す（招待 redeem の pending より優先） */
let stubMeActivePair = false;
const stubMoodByDay: Record<string, { body: string; savedAt: string }> = {};
const stubWhisperByDay: Record<string, { body: string; savedAt: string }> = {};
type StubChatMsg = {
  id: string;
  role: "user" | "assistant";
  body: string;
  createdAt: string;
  topicUserId: string | null;
};
let stubChatMessages: StubChatMsg[] = [];
const stubNicknameByUserId = new Map<string, string | null>();

afterEach(() => {
  stubRedeemPendingPair = false;
  stubMeActivePair = false;
  for (const k of Object.keys(stubMoodByDay)) {
    delete stubMoodByDay[k];
  }
  for (const k of Object.keys(stubWhisperByDay)) {
    delete stubWhisperByDay[k];
  }
  stubChatMessages = [];
  stubNicknameByUserId.clear();
  cleanup();
});

const STUB_PAIR_ACTIVE_ME = {
  id: "pair_test",
  displayName: "てすと",
  yourRole: "owner" as const,
  membershipState: "active" as const,
  relationshipTag: "family" as const,
};

const STUB_PAIR_PENDING_ME = {
  id: "pair_test",
  displayName: "てすと",
  yourRole: "member" as const,
  membershipState: "pending_owner_approval" as const,
  relationshipTag: "family" as const,
};

function stubPairForMeEndpoints():
  | typeof STUB_PAIR_ACTIVE_ME
  | typeof STUB_PAIR_PENDING_ME
  | null {
  if (stubMeActivePair) {
    return STUB_PAIR_ACTIVE_ME;
  }
  if (stubRedeemPendingPair) {
    return STUB_PAIR_PENDING_ME;
  }
  return null;
}

/** `phase1-navigation-flow` などから呼ぶ。`afterEach` でリセットされる。 */
export function setStubMePairActiveForTests(enabled: boolean): void {
  stubMeActivePair = enabled;
}

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
    let pathname = "";
    try {
      pathname = new URL(url, "http://localhost").pathname;
    } catch {
      pathname = "";
    }

    if (url.includes("/api/dev/dummy-users")) {
      return new Response(JSON.stringify({ users: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname === "/api/announcements" && method === "GET") {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          announcements: [
            {
              id: "ann_stub",
              title: "スタブのお知らせ",
              body: "テスト用の短い本文です。",
              publishedAt: "2026-05-01T00:00:00.000Z",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (pathname === "/api/me/pairs" && method === "GET") {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      const pair = stubPairForMeEndpoints();
      if (pair === null) {
        return new Response(JSON.stringify({ pairs: [], activePairId: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ pairs: [pair], activePairId: pair.id }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (pathname === "/api/me/active-pair" && method === "PUT") {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          pair: {
            id: "pair_test",
            displayName: "てすと",
            yourRole: "owner" as const,
            membershipState: "active" as const,
            relationshipTag: "family" as const,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (pathname === "/api/me/profile" && method === "PUT") {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      let body: unknown = {};
      try {
        body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as unknown;
      } catch {
        body = {};
      }
      const rec = body as Record<string, unknown>;
      if (!("nickname" in rec)) {
        return new Response(
          JSON.stringify({ error: { code: "validation_error", message: "nickname が必要です" } }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      const raw = rec.nickname;
      if (raw !== null && typeof raw !== "string") {
        return new Response(
          JSON.stringify({ error: { code: "validation_error", message: "ニックネームを読み取れませんでした" } }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      const trimmed = typeof raw === "string" ? raw.trim() : "";
      const nick = trimmed === "" ? null : trimmed;
      if (nick !== null && nick.length > 40) {
        return new Response(
          JSON.stringify({ error: { code: "validation_error", message: "ニックネームが長すぎます" } }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      if (nick === null) {
        stubNicknameByUserId.delete(hasUser);
      } else {
        stubNicknameByUserId.set(hasUser, nick);
      }
      const authLabel = "テスト";
      const displayName = nick ?? authLabel;
      const pair = stubPairForMeEndpoints();
      return new Response(
        JSON.stringify({
          user: { id: hasUser, displayName, nickname: nick, authDisplayName: authLabel },
          pair,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (pathname === "/api/me" && method === "GET") {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      const authLabel = "テスト";
      const pair = stubPairForMeEndpoints();
      const nick = stubNicknameByUserId.get(hasUser) ?? null;
      const displayName = nick !== null && nick !== "" ? nick : authLabel;

      return new Response(
        JSON.stringify({
          user: {
            id: hasUser,
            displayName,
            nickname: nick !== null && nick !== "" ? nick : null,
            authDisplayName: authLabel,
          },
          pair,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (method === "GET" && /^\/api\/pairs\/[^/]+\/members$/.test(pathname)) {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ members: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && /^\/api\/pairs\/[^/]+\/settings\/privacy$/.test(pathname)) {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ chatRetention: "30days" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "PUT" && /^\/api\/pairs\/[^/]+\/settings\/privacy$/.test(pathname)) {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      let body: Record<string, unknown> = {};
      if (typeof init?.body === "string" && init.body.length > 0) {
        try {
          body = JSON.parse(init.body) as Record<string, unknown>;
        } catch {
          body = {};
        }
      }
      const cr = body.chatRetention;
      const chatRetention =
        cr === "none" || cr === "30days" || cr === "90days" ? cr : "30days";
      return new Response(JSON.stringify({ chatRetention }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && /^\/api\/pairs\/[^/]+\/mood\/daily-prompt$/.test(pathname)) {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      let day = new Date().toISOString().slice(0, 10);
      try {
        const u = new URL(url, "http://localhost");
        const dq = u.searchParams.get("date");
        if (dq !== null && dq.trim() !== "") {
          day = dq.trim();
        }
      } catch {
        /* 無視 */
      }
      return new Response(
        JSON.stringify({
          date: day,
          promptId: "p_stub",
          question: "スタブの質問です。どれに近いですか。",
          choices: [
            { id: "0", label: "あ" },
            { id: "1", label: "い" },
            { id: "2", label: "う" },
            { id: "3", label: "わからない" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (method === "POST" && /^\/api\/pairs\/[^/]+\/mood\/daily-choice$/.test(pathname)) {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      let body: Record<string, unknown> = {};
      if (typeof init?.body === "string" && init.body.length > 0) {
        try {
          body = JSON.parse(init.body) as Record<string, unknown>;
        } catch {
          body = {};
        }
      }
      const choiceId = body.choiceId;
      if (typeof choiceId !== "string") {
        return new Response(
          JSON.stringify({ error: { code: "validation_error", message: "選び方を読み取れませんでした" } }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      let day = new Date().toISOString().slice(0, 10);
      const dr = body.date;
      if (typeof dr === "string" && dr.trim() !== "") {
        day = dr.trim();
      }
      const lines = ["スタブ：あ。", "スタブ：い。", "スタブ：う。", "スタブ：わからない。"];
      const idx = Number.parseInt(choiceId, 10);
      const line = Number.isInteger(idx) && idx >= 0 && idx < lines.length ? lines[idx]! : null;
      if (line === null) {
        return new Response(
          JSON.stringify({ error: { code: "validation_error", message: "選び方か、長さの上限に合いませんでした" } }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      const prev = stubMoodByDay[day];
      const merged = prev === undefined ? line : `${prev.body.trimEnd()}\n${line}`;
      const savedAt = new Date().toISOString();
      stubMoodByDay[day] = { body: merged, savedAt };
      return new Response(JSON.stringify({ mood: { date: day, body: merged, savedAt } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && /^\/api\/pairs\/[^/]+\/mood$/.test(pathname)) {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      let day = new Date().toISOString().slice(0, 10);
      try {
        const u = new URL(url, "http://localhost");
        const dq = u.searchParams.get("date");
        if (dq !== null && dq.trim() !== "") {
          day = dq.trim();
        }
      } catch {
        /* 無視 */
      }
      const row = stubMoodByDay[day];
      const mood = row === undefined ? null : { date: day, body: row.body, savedAt: row.savedAt };
      return new Response(JSON.stringify({ date: day, mood }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && /^\/api\/pairs\/[^/]+\/whisper$/.test(pathname)) {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      let day = new Date().toISOString().slice(0, 10);
      try {
        const u = new URL(url, "http://localhost");
        const dq = u.searchParams.get("date");
        if (dq !== null && dq.trim() !== "") {
          day = dq.trim();
        }
      } catch {
        /* 無視 */
      }
      const row = stubWhisperByDay[day];
      const whisper = row === undefined ? null : { date: day, body: row.body, savedAt: row.savedAt };
      return new Response(JSON.stringify({ date: day, whisper }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "PUT" && /^\/api\/pairs\/[^/]+\/whisper$/.test(pathname)) {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      let body: Record<string, unknown> = {};
      if (typeof init?.body === "string" && init.body.length > 0) {
        try {
          body = JSON.parse(init.body) as Record<string, unknown>;
        } catch {
          body = {};
        }
      }
      const text = body.body;
      if (typeof text !== "string" || text.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: { code: "validation_error", message: "文章が、まだありません" } }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      if (text.length > 2000) {
        return new Response(
          JSON.stringify({ error: { code: "validation_error", message: "文章が長すぎます" } }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      let day = new Date().toISOString().slice(0, 10);
      const dr = body.date;
      if (typeof dr === "string" && dr.trim() !== "") {
        day = dr.trim();
      }
      stubWhisperByDay[day] = { body: text.trim(), savedAt: new Date().toISOString() };
      const saved = stubWhisperByDay[day]!;
      return new Response(JSON.stringify({ whisper: { date: day, body: saved.body, savedAt: saved.savedAt } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "PUT" && /^\/api\/pairs\/[^/]+\/mood$/.test(pathname)) {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      let body: Record<string, unknown> = {};
      if (typeof init?.body === "string" && init.body.length > 0) {
        try {
          body = JSON.parse(init.body) as Record<string, unknown>;
        } catch {
          body = {};
        }
      }
      const text = body.body;
      if (typeof text !== "string" || text.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: { code: "validation_error", message: "文章が、まだありません" } }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      if (text.length > 2000) {
        return new Response(
          JSON.stringify({ error: { code: "validation_error", message: "文章が長すぎます" } }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      let day = new Date().toISOString().slice(0, 10);
      const dr = body.date;
      if (typeof dr === "string" && dr.trim() !== "") {
        day = dr.trim();
      }
      stubMoodByDay[day] = { body: text.trim(), savedAt: new Date().toISOString() };
      const saved = stubMoodByDay[day]!;
      return new Response(JSON.stringify({ mood: { date: day, body: saved.body, savedAt: saved.savedAt } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && /^\/api\/pairs\/[^/]+\/notifications$/.test(pathname)) {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          notifications: [
            {
              id: "ntf_stub_01",
              headline: "朝のかたち",
              body: "スタブ用の短い通知です。",
              createdAt: new Date(Date.now() - 86400000).toISOString(),
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (method === "GET" && /^\/api\/pairs\/[^/]+\/chat\/messages$/.test(pathname)) {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ messages: stubChatMessages }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && /^\/api\/pairs\/[^/]+\/chat\/messages$/.test(pathname)) {
      const hasUser = (init?.headers as Headers | undefined)?.get?.("X-Nagi-User-Id") ?? null;
      if (hasUser === null || hasUser === "") {
        return new Response(
          JSON.stringify({ error: { code: "unauthorized", message: "利用者がまだ選ばれていません" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      let body: Record<string, unknown> = {};
      if (typeof init?.body === "string" && init.body.length > 0) {
        try {
          body = JSON.parse(init.body) as Record<string, unknown>;
        } catch {
          body = {};
        }
      }
      const text = body.text;
      if (typeof text !== "string" || text.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: { code: "validation_error", message: "文章が、まだありません" } }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      const topicRaw = body.topicUserId;
      const topicUserId =
        typeof topicRaw === "string" && topicRaw.trim() !== "" ? topicRaw.trim() : null;
      const now = new Date().toISOString();
      stubChatMessages.push({
        id: `stub_u_${stubChatMessages.length}`,
        role: "user",
        body: text.trim(),
        createdAt: now,
        topicUserId,
      });
      stubChatMessages.push({
        id: `stub_a_${stubChatMessages.length}`,
        role: "assistant",
        body: "スタブの返事です。断定はしません。",
        createdAt: new Date().toISOString(),
        topicUserId,
      });
      return new Response(JSON.stringify({ messages: stubChatMessages }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
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

    if (url.includes("/api/pairs/") && url.includes("/pending-members") && method === "GET") {
      return new Response(JSON.stringify({ members: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/api/pairs/") && url.includes("/members/") && url.includes("/approve") && method === "POST") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname === "/api/pairs" && method === "POST") {
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
