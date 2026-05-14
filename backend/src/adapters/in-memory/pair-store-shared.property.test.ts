import { describe, expect, it } from "vitest";
import { generateInviteCode, INVITE_ALPHABET } from "./pair-store-shared.js";

describe("generateInviteCode（簡易プロパティ検査）", () => {
  it("長さが一定で、すべての文字が INVITE_ALPHABET に含まれる", () => {
    for (let i = 0; i < 400; i += 1) {
      const code = generateInviteCode();
      expect(code).toHaveLength(12);
      for (const ch of code) {
        expect(INVITE_ALPHABET.includes(ch)).toBe(true);
      }
    }
  });

  it("連続生成でも空にならない", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 80; i += 1) {
      codes.add(generateInviteCode());
    }
    expect(codes.size).toBeGreaterThan(70);
  });
});
