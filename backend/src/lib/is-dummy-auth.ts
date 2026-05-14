/**
 * Phase 1 の `X-Nagi-User-Id` と `/api/dev/*` を許可するか。
 * 本番では `NAGI_DUMMY_AUTH=0` にして Firebase ID トークンのみに寄せる。
 */
export function isDummyAuthAllowed(): boolean {
  return process.env.NAGI_DUMMY_AUTH !== "0";
}
