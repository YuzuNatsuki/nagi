/** バックエンド契約に合わせた最小型（拡張時はここを更新する） */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export type HealthResponse = {
  ok: true;
  service: string;
};

export type PairMembershipState = "active" | "pending_owner_approval";

export type RelationshipTagId =
  | "family"
  | "partners"
  | "friends"
  | "care"
  | "other";

export type PairSummary = {
  id: string;
  displayName: string;
  yourRole: "owner" | "member";
  membershipState: PairMembershipState;
  relationshipTag: RelationshipTagId;
};

export type MeResponse = {
  user: {
    id: string;
    displayName: string;
  };
  pair: PairSummary | null;
};

export type CreatePairRequestBody = {
  pairDisplayName: string;
  relationshipTag: RelationshipTagId;
};

export type CreatePairResponseBody = {
  pair: PairSummary;
  invite: {
    code: string;
    expiresAt: string;
  };
};

export type PairInviteResponseBody = {
  code: string;
  expiresAt: string;
};

export type RedeemInviteRequestBody = {
  code: string;
};

export type RedeemInviteResponseBody = {
  pair: PairSummary;
};

export type DummyUserOption = {
  id: string;
  displayName: string;
  note: string;
};

export type DummyUsersResponse = {
  users: DummyUserOption[];
};
