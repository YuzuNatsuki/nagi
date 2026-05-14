import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getApps } from "firebase-admin/app";
import type { NagiUser } from "../../auth/nagi-user.js";
import {
  getDummyNicknameOverride,
  setDummyNicknameOverride,
} from "../in-memory/dummy-user-nickname.js";
import { isDummyUserId } from "../in-memory/dummy-users.js";

export type MergedUserProfile = {
  /** 画面に出す名前（ニックネームがあればそれ、なければ認証由来の表示名） */
  displayName: string;
  /** 利用者が設定したニックネーム。未設定は null */
  nickname: string | null;
  /** Firebase 等から来た表示名（参考表示用） */
  authDisplayName: string;
};

/**
 * 認証済み利用者のプロフィールを Firestore に同期する（サーバのみ書き込み）。
 * `nickname` は上書きしない（PUT /api/me/profile 専用）。
 */
export async function upsertNagiUserProfileIfConfigured(user: NagiUser): Promise<void> {
  if (isDummyUserId(user.id)) {
    return;
  }
  if (getApps().length === 0) {
    return;
  }
  if (process.env.FIRESTORE_ENABLED === "0") {
    return;
  }
  const db = getFirestore();
  await db
    .collection("users")
    .doc(user.id)
    .set(
      {
        authDisplayName: user.displayName,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

export async function mergeUserDisplayForApi(user: NagiUser): Promise<MergedUserProfile> {
  if (isDummyUserId(user.id)) {
    const nick = getDummyNicknameOverride(user.id);
    return {
      displayName: nick ?? user.displayName,
      nickname: nick,
      authDisplayName: user.displayName,
    };
  }
  if (getApps().length === 0 || process.env.FIRESTORE_ENABLED === "0") {
    return { displayName: user.displayName, nickname: null, authDisplayName: user.displayName };
  }
  try {
    const db = getFirestore();
    const snap = await db.collection("users").doc(user.id).get();
    const raw = snap.exists ? (snap.data() as { nickname?: unknown }).nickname : undefined;
    let nick: string | null = null;
    if (typeof raw === "string") {
      const t = raw.trim();
      nick = t === "" ? null : t;
    }
    return {
      displayName: nick ?? user.displayName,
      nickname: nick,
      authDisplayName: user.displayName,
    };
  } catch (e) {
    console.warn("mergeUserDisplayForApi", e);
    return { displayName: user.displayName, nickname: null, authDisplayName: user.displayName };
  }
}

const MAX_NICKNAME_CHARS = 40;

export function validateNicknameInput(raw: unknown): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, message: "ニックネームを読み取れませんでした" };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  if (trimmed.length > MAX_NICKNAME_CHARS) {
    return { ok: false, message: "ニックネームが長すぎます" };
  }
  return { ok: true, value: trimmed };
}

/**
 * ニックネームを保存する。空/null は未設定に戻す。
 * ダミー UID はメモリのみ。Firestore 利用不可時は例外。
 */
export async function writeUserNicknameIfConfigured(userId: string, nickname: string | null): Promise<void> {
  if (isDummyUserId(userId)) {
    setDummyNicknameOverride(userId, nickname);
    return;
  }
  if (getApps().length === 0) {
    throw new Error("firestore_unavailable");
  }
  if (process.env.FIRESTORE_ENABLED === "0") {
    throw new Error("firestore_disabled");
  }
  const db = getFirestore();
  const payload: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (nickname === null || nickname === "") {
    payload.nickname = FieldValue.delete();
  } else {
    payload.nickname = nickname;
  }
  await db.collection("users").doc(userId).set(payload, { merge: true });
}
