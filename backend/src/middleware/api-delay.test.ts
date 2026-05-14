import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { apiDelayMiddleware } from "./api-delay.js";

describe("apiDelayMiddleware", () => {
  it("next を遅延後に一度だけ呼ぶ", async () => {
    vi.stubEnv("VITEST", "");
    vi.useFakeTimers();
    const next = vi.fn() as unknown as NextFunction;
    const req = { path: "/pairs/p1/mood", originalUrl: "/api/pairs/p1/mood" } as Request;
    const res = {} as Response;

    apiDelayMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();
    expect(next).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });
});
