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

export type MePairsResponseBody = {
  pairs: PairSummary[];
  activePairId: string | null;
};

export type PutActivePairResponseBody = {
  pair: PairSummary;
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

export type PendingMemberRow = {
  userId: string;
  displayName: string;
};

export type PendingMembersResponseBody = {
  members: PendingMemberRow[];
};

export type ApproveMemberResponseBody = {
  ok: true;
};

export type ChatRetentionChoice = "none" | "30days" | "90days";

export type PairMemberRow = {
  userId: string;
  displayName: string;
  role: "owner" | "member";
  membershipState: PairMembershipState;
};

export type PairMembersResponseBody = {
  members: PairMemberRow[];
};

export type PairPrivacyResponseBody = {
  chatRetention: ChatRetentionChoice;
};

export type MoodSnapshot = {
  date: string;
  body: string;
  savedAt: string;
};

export type GetMoodResponseBody = {
  date: string;
  mood: MoodSnapshot | null;
};

export type PutMoodRequestBody = {
  body: string;
  /** 省略時はサーバ側の UTC 暦日の「今日」（フロントでは必ず送る想定） */
  date?: string;
};

export type PutMoodResponseBody = {
  mood: MoodSnapshot;
};

export type MoodDailyChoiceItem = {
  id: string;
  label: string;
};

export type MoodDailyPromptResponseBody = {
  date: string;
  promptId: string;
  question: string;
  choices: MoodDailyChoiceItem[];
};

export type PostMoodDailyChoiceRequestBody = {
  date: string;
  choiceId: string;
};

export type PostMoodDailyChoiceResponseBody = {
  mood: MoodSnapshot;
};

export type WhisperSnapshot = {
  date: string;
  body: string;
  savedAt: string;
};

export type GetWhisperResponseBody = {
  date: string;
  whisper: WhisperSnapshot | null;
};

export type PutWhisperRequestBody = {
  body: string;
  date?: string;
};

export type PutWhisperResponseBody = {
  whisper: WhisperSnapshot;
};

export type NotificationHistoryItem = {
  id: string;
  headline: string;
  body: string;
  createdAt: string;
};

export type NotificationHistoryResponseBody = {
  notifications: NotificationHistoryItem[];
};

export type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
};

export type AnnouncementsResponseBody = {
  announcements: AnnouncementItem[];
};

export type ChatMessageRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  body: string;
  createdAt: string;
  topicUserId: string | null;
};

export type ChatMessagesResponseBody = {
  messages: ChatMessage[];
};

export type PostChatMessageRequestBody = {
  text: string;
  topicUserId?: string | null;
};

export type DummyUserOption = {
  id: string;
  displayName: string;
  note: string;
};

export type DummyUsersResponse = {
  users: DummyUserOption[];
};
