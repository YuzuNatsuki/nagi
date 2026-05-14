import { FieldValue, getFirestore } from "firebase-admin/firestore";

/** `SPEC.md` の `pair_audit_log` に相当するトップレベルコレクション */
const COLLECTION = "pair_audit_log";

export type PairAuditLogEventType = "pair_created" | "invite_redeemed" | "member_approved";

export type PairAuditLogPayload = {
  pairId: string;
  type: PairAuditLogEventType;
  /** 操作主体（オーナー・招待を入力した利用者など） */
  actorUserId: string;
  /** 承認対象の利用者 ID など */
  subjectUserId?: string;
  /** 小さな補助フィールドのみ（ネストは避ける） */
  meta?: Record<string, string | boolean | number | null>;
};

/**
 * ペア関連の監査イベントを追記する。失敗しても本体トランザクションは成功させるため、
 * 例外は握りつぶしてログだけ残す。
 */
export async function appendPairAuditLogSafe(payload: PairAuditLogPayload): Promise<void> {
  try {
    await getFirestore()
      .collection(COLLECTION)
      .add({
        ...payload,
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (e) {
    console.warn("[pair_audit_log] append failed", e);
  }
}
