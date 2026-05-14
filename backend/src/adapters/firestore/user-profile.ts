import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getApps } from "firebase-admin/app";
import type { NagiUser } from "../../auth/nagi-user.js";
import { isDummyUserId } from "../in-memory/dummy-users.js";

/**
 * 認証済み利用者のプロフィールを Firestore に同期する（サーバのみ書き込み）。
 * Phase 1 固定ダミー ID は書かない。Admin が未初期化のときは何もしない。
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
        displayName: user.displayName,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}
