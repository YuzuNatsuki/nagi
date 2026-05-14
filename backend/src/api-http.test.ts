import cors from "cors";
import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApiRouter } from "./adapters/runtime-backend-adapter.js";
import { clearDummyUserNicknameOverridesForTests } from "./adapters/in-memory/dummy-user-nickname.js";
import { resetInMemoryPairStateForTests } from "./adapters/in-memory/pair-store.js";

const USER_HEADER = "x-nagi-user-id";

function createTestApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: true,
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Nagi-User-Id",
        "X-Nagi-Firebase-Id-Token",
      ],
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createApiRouter());
  return app;
}

function listen(app: express.Express): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") {
        reject(new Error("invalid listen address"));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise<void>((res, rej) => {
            server.close((err) => {
              if (err) {
                rej(err);
              } else {
                res();
              }
            });
          }),
      });
    });
    server.on("error", reject);
  });
}

describe("HTTP API (Phase 1)", () => {
  let baseUrl = "";
  let close: () => Promise<void> = async () => {};

  beforeEach(async () => {
    resetInMemoryPairStateForTests();
    clearDummyUserNicknameOverridesForTests();
    const s = await listen(createTestApp());
    baseUrl = s.baseUrl;
    close = s.close;
  });

  afterEach(async () => {
    await close();
  });

  it("GET /api/health は 200", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean };
    expect(j.ok).toBe(true);
  });

  it("未認可の /api/me は 401", async () => {
    const res = await fetch(`${baseUrl}/api/me`);
    expect(res.status).toBe(401);
  });

  it("PUT /api/me/profile でニックネームを保存し GET /api/me で返る", async () => {
    const putRes = await fetch(`${baseUrl}/api/me/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        [USER_HEADER]: "user-owner-01",
      },
      body: JSON.stringify({ nickname: "凪のてすと" }),
    });
    expect(putRes.status).toBe(200);
    const putBody = (await putRes.json()) as {
      user: { displayName: string; nickname: string | null; authDisplayName: string };
    };
    expect(putBody.user.displayName).toBe("凪のてすと");
    expect(putBody.user.nickname).toBe("凪のてすと");
    expect(putBody.user.authDisplayName).toBe("ひかり");

    const getRes = await fetch(`${baseUrl}/api/me`, { headers: { [USER_HEADER]: "user-owner-01" } });
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as {
      user: { displayName: string; nickname: string | null; authDisplayName: string };
    };
    expect(getBody.user.displayName).toBe("凪のてすと");
    expect(getBody.user.nickname).toBe("凪のてすと");
    expect(getBody.user.authDisplayName).toBe("ひかり");
  });

  it("ペアに入っていない利用者の mood 取得は 403", async () => {
    const createRes = await fetch(`${baseUrl}/api/pairs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [USER_HEADER]: "user-owner-01",
      },
      body: JSON.stringify({ pairDisplayName: "テストペア", relationshipTag: "friends" }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { pair: { id: string } };
    const pairId = created.pair.id;

    const moodRes = await fetch(`${baseUrl}/api/pairs/${pairId}/mood?dayKey=2026-01-01`, {
      headers: { [USER_HEADER]: "user-member-03" },
    });
    expect(moodRes.status).toBe(403);
    const err = (await moodRes.json()) as { error: { code: string } };
    expect(err.error.code).toBe("forbidden");
  });

  it("招待の入力からオーナー承認までのあと、通知一覧が読める", async () => {
    const jsonHeaders = { "Content-Type": "application/json", [USER_HEADER]: "user-owner-01" };
    const createRes = await fetch(`${baseUrl}/api/pairs`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ pairDisplayName: "氷室", relationshipTag: "partners" }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      pair: { id: string };
      invite: { code: string };
    };
    const { id: pairId } = created.pair;
    const { code } = created.invite;

    const redeemRes = await fetch(`${baseUrl}/api/invites/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", [USER_HEADER]: "user-member-02" },
      body: JSON.stringify({ code }),
    });
    expect(redeemRes.status).toBe(201);

    const pendRes = await fetch(`${baseUrl}/api/pairs/${pairId}/pending-members`, {
      headers: { [USER_HEADER]: "user-owner-01" },
    });
    expect(pendRes.status).toBe(200);

    const apprRes = await fetch(`${baseUrl}/api/pairs/${pairId}/members/user-member-02/approve`, {
      method: "POST",
      headers: { [USER_HEADER]: "user-owner-01" },
    });
    expect(apprRes.status).toBe(200);

    const nRes = await fetch(`${baseUrl}/api/pairs/${pairId}/notifications`, {
      headers: { [USER_HEADER]: "user-member-02" },
    });
    expect(nRes.status).toBe(200);
    const nBody = (await nRes.json()) as { notifications: unknown[] };
    expect(nBody.notifications.length).toBeGreaterThanOrEqual(1);
  });
});
