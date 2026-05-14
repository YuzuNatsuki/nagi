import { randomBytes } from "node:crypto";

export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
export const INVITE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
export const MAX_PAIR_MEMBERS = 4;
export const MAX_PAIRS_PER_USER = 4;
export const MAX_SOLO_BODY_CHARS = 2000;
export const MAX_CHAT_BODY_CHARS = 4000;

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export function generateInviteCode(): string {
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 12; i += 1) {
    out += INVITE_ALPHABET[bytes[i]! % INVITE_ALPHABET.length]!;
  }
  return out;
}
