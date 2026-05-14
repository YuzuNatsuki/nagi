/** Phase 1 ダミー利用者向けの表示名オーバーライド（Firestore なし環境用）。 */
const nicknameByUserId = new Map<string, string>();

export function getDummyNicknameOverride(userId: string): string | null {
  const v = nicknameByUserId.get(userId);
  if (v === undefined || v === "") {
    return null;
  }
  return v;
}

export function setDummyNicknameOverride(userId: string, nickname: string | null): void {
  if (nickname === null || nickname.trim() === "") {
    nicknameByUserId.delete(userId);
    return;
  }
  nicknameByUserId.set(userId, nickname.trim());
}

/** 単体テスト用 */
export function clearDummyUserNicknameOverridesForTests(): void {
  nicknameByUserId.clear();
}
