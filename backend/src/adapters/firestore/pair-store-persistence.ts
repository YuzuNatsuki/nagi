import { getApps } from "firebase-admin/app";

/**
 * Firestore をペアデータの正とするか。
 * - Admin 未初期化（単体テスト等）では false。
 * - FIRESTORE_ENABLED=0 または FIRESTORE_PAIRS_ENABLED=0 で明示オフ。
 * - ダミー UID の操作は pair-store ファサード側でメモリに寄せる。
 */
export function isFirestorePairsPersistenceActive(): boolean {
  if (process.env.FIRESTORE_ENABLED === "0") {
    return false;
  }
  if (process.env.FIRESTORE_PAIRS_ENABLED === "0") {
    return false;
  }
  return getApps().length > 0;
}
