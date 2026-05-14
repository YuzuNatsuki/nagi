import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    async getClient(): Promise<{ getAccessToken: () => Promise<{ token: string }> }> {
      return {
        getAccessToken: async () => ({ token: "vertex-unit-test-token" }),
      };
    }
  },
}));

import { buildAssistantReplyLocal, resolveAssistantReply } from "./chat-assistant-reply.js";

describe("chat-assistant-reply", () => {
  const prevOff = process.env.NAGI_CHAT_AI_ENABLED;
  const prevFbProject = process.env.FIREBASE_PROJECT_ID;

  beforeEach(() => {
    delete process.env.NAGI_CHAT_AI_ENABLED;
    delete process.env.FIREBASE_PROJECT_ID;
  });

  afterEach(() => {
    if (prevOff === undefined) {
      delete process.env.NAGI_CHAT_AI_ENABLED;
    } else {
      process.env.NAGI_CHAT_AI_ENABLED = prevOff;
    }
    if (prevFbProject === undefined) {
      delete process.env.FIREBASE_PROJECT_ID;
    } else {
      process.env.FIREBASE_PROJECT_ID = prevFbProject;
    }
    vi.unstubAllGlobals();
  });

  it("プロジェクト ID が無いときは Vertex を試さずローカルと一致する", async () => {
    const local = buildAssistantReplyLocal("今日は疲れた", null);
    const resolved = await resolveAssistantReply("今日は疲れた", null);
    expect(resolved).toBe(local);
  });

  it("NAGI_CHAT_AI_ENABLED=0 のときは常にローカル", async () => {
    process.env.NAGI_CHAT_AI_ENABLED = "0";
    process.env.FIREBASE_PROJECT_ID = "has-project-but-off";
    const local = buildAssistantReplyLocal("天気がいい", null);
    const resolved = await resolveAssistantReply("天気がいい", null);
    expect(resolved).toBe(local);
  });

  it("Vertex が成功したときはその本文を使う", async () => {
    process.env.FIREBASE_PROJECT_ID = "unit-test-proj";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "  Vertex 経由です。  " }] } }],
          }),
      })) as unknown as typeof fetch,
    );

    const resolved = await resolveAssistantReply("あいさつ", null);
    expect(resolved).toBe("Vertex 経由です。");
  });
});
