/** Phase 1 固定ダミー利用者（UI の切替と同一リストを維持する） */
export type DummyUser = {
  id: string;
  displayName: string;
  note: string;
};

export const DUMMY_USERS: readonly DummyUser[] = [
  {
    id: "user-owner-01",
    displayName: "ひかり",
    note: "ペア作成側の想定",
  },
  {
    id: "user-member-02",
    displayName: "美咲",
    note: "招待で入る側の想定",
  },
  {
    id: "user-member-03",
    displayName: "健太",
    note: "追加メンバーの想定",
  },
] as const;

export function findDummyUserById(userId: string): DummyUser | undefined {
  return DUMMY_USERS.find((u) => u.id === userId);
}
