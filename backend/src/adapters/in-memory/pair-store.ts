import type { RelationshipTagId } from "./relationship-tags.js";
import { isDummyUserId } from "./dummy-users.js";
import { isFirestorePairsPersistenceActive } from "../firestore/pair-store-persistence.js";
import * as firestore from "../firestore/pair-store-firestore.js";
import type {
  ApproveMemberResult,
  ApplyMoodDailyChoiceResult,
  ChatMessageRow,
  ChatRetentionChoice,
  GetMoodDailyPromptResult,
  GetMyMoodResult,
  GetMyWhisperResult,
  InviteLookupResult,
  ListChatMessagesResult,
  ListNotificationsResult,
  ListPairMembersResult,
  ListPendingMembersResult,
  MoodDailyChoiceItem,
  MoodDailyPromptPayload,
  MoodSnapshot,
  NotificationHistoryItem,
  PairCreateResult,
  PairMemberListItem,
  PairMembershipState,
  PairPrivacyResult,
  PairSummaryForUser,
  PostChatMessageResult,
  RedeemInviteResult,
  SaveMyMoodResult,
  SaveMyWhisperResult,
  SetActivePairResult,
  WhisperSnapshot,
} from "./pair-store-memory.js";
import * as memory from "./pair-store-memory.js";

export type {
  ApproveMemberResult,
  ApplyMoodDailyChoiceResult,
  ChatMessageRow,
  ChatRetentionChoice,
  GetMoodDailyPromptResult,
  GetMyMoodResult,
  GetMyWhisperResult,
  InviteLookupResult,
  ListChatMessagesResult,
  ListNotificationsResult,
  ListPairMembersResult,
  ListPendingMembersResult,
  MoodDailyChoiceItem,
  MoodDailyPromptPayload,
  MoodSnapshot,
  NotificationHistoryItem,
  PairCreateResult,
  PairMemberListItem,
  PairMembershipState,
  PairPrivacyResult,
  PairSummaryForUser,
  PostChatMessageResult,
  RedeemInviteResult,
  SaveMyMoodResult,
  SaveMyWhisperResult,
  SetActivePairResult,
  WhisperSnapshot,
} from "./pair-store-memory.js";

export { buildMoodDailyPromptPayload } from "./pair-store-memory.js";

function useFirestoreForUser(userId: string): boolean {
  return isFirestorePairsPersistenceActive() && !isDummyUserId(userId);
}

export const parseCalendarDayStrict = memory.parseCalendarDayStrict;
export const resolveCalendarDayForApi = memory.resolveCalendarDayForApi;
export const resetInMemoryPairStateForTests = memory.resetInMemoryPairStateForTests;

export async function redeemInviteCode(userId: string, rawCode: string): Promise<RedeemInviteResult> {
  if (!useFirestoreForUser(userId)) {
    return memory.redeemInviteCode(userId, rawCode);
  }
  return firestore.redeemInviteCode(userId, rawCode);
}

export async function listPendingMemberUserIdsForPair(
  pairId: string,
  actorUserId: string,
): Promise<ListPendingMembersResult> {
  if (!useFirestoreForUser(actorUserId)) {
    return memory.listPendingMemberUserIdsForPair(pairId, actorUserId);
  }
  return firestore.listPendingMemberUserIdsForPair(pairId, actorUserId);
}

export async function approvePendingMember(
  actorUserId: string,
  pairId: string,
  memberUserId: string,
): Promise<ApproveMemberResult> {
  if (!useFirestoreForUser(actorUserId)) {
    return memory.approvePendingMember(actorUserId, pairId, memberUserId);
  }
  return firestore.approvePendingMember(actorUserId, pairId, memberUserId);
}

export async function getPairSummaryForUser(userId: string): Promise<PairSummaryForUser | null> {
  if (!useFirestoreForUser(userId)) {
    return memory.getPairSummaryForUser(userId);
  }
  return firestore.getPairSummaryForUser(userId);
}

export async function listPairSummariesForUser(userId: string): Promise<PairSummaryForUser[]> {
  if (!useFirestoreForUser(userId)) {
    return memory.listPairSummariesForUser(userId);
  }
  return firestore.listPairSummariesForUser(userId);
}

export async function setActivePairForUser(userId: string, pairId: string): Promise<SetActivePairResult> {
  if (!useFirestoreForUser(userId)) {
    return memory.setActivePairForUser(userId, pairId);
  }
  return firestore.setActivePairForUser(userId, pairId);
}

export async function createOwnedPair(
  ownerUserId: string,
  input: { pairDisplayName: string; relationshipTag: RelationshipTagId },
): Promise<PairCreateResult> {
  if (!useFirestoreForUser(ownerUserId)) {
    return memory.createOwnedPair(ownerUserId, input);
  }
  return firestore.createOwnedPair(ownerUserId, input);
}

export async function getActiveInviteForPairOwner(pairId: string, userId: string): Promise<InviteLookupResult> {
  if (!useFirestoreForUser(userId)) {
    return memory.getActiveInviteForPairOwner(pairId, userId);
  }
  return firestore.getActiveInviteForPairOwner(pairId, userId);
}

export async function listPairMembersForActor(
  actorUserId: string,
  pairId: string,
): Promise<ListPairMembersResult> {
  if (!useFirestoreForUser(actorUserId)) {
    return memory.listPairMembersForActor(actorUserId, pairId);
  }
  return firestore.listPairMembersForActor(actorUserId, pairId);
}

export async function getPairPrivacySettingsForActor(
  actorUserId: string,
  pairId: string,
): Promise<PairPrivacyResult> {
  if (!useFirestoreForUser(actorUserId)) {
    return memory.getPairPrivacySettingsForActor(actorUserId, pairId);
  }
  return firestore.getPairPrivacySettingsForActor(actorUserId, pairId);
}

export async function setPairPrivacySettingsForActor(
  actorUserId: string,
  pairId: string,
  chatRetention: ChatRetentionChoice,
): Promise<PairPrivacyResult> {
  if (!useFirestoreForUser(actorUserId)) {
    return memory.setPairPrivacySettingsForActor(actorUserId, pairId, chatRetention);
  }
  return firestore.setPairPrivacySettingsForActor(actorUserId, pairId, chatRetention);
}

export async function getMoodDailyPromptForActor(
  actorUserId: string,
  pairId: string,
  dayKey: string,
): Promise<GetMoodDailyPromptResult> {
  if (!useFirestoreForUser(actorUserId)) {
    return memory.getMoodDailyPromptForActor(actorUserId, pairId, dayKey);
  }
  return firestore.getMoodDailyPromptForActor(actorUserId, pairId, dayKey);
}

export async function applyMoodDailyChoiceForActor(
  actorUserId: string,
  pairId: string,
  dayKey: string,
  choiceId: string,
): Promise<ApplyMoodDailyChoiceResult> {
  if (!useFirestoreForUser(actorUserId)) {
    return memory.applyMoodDailyChoiceForActor(actorUserId, pairId, dayKey, choiceId);
  }
  return firestore.applyMoodDailyChoiceForActor(actorUserId, pairId, dayKey, choiceId);
}

export async function getMyMoodForPair(
  actorUserId: string,
  pairId: string,
  dayKey: string,
): Promise<GetMyMoodResult> {
  if (!useFirestoreForUser(actorUserId)) {
    return memory.getMyMoodForPair(actorUserId, pairId, dayKey);
  }
  return firestore.getMyMoodForPair(actorUserId, pairId, dayKey);
}

export async function saveMyMoodForPair(
  actorUserId: string,
  pairId: string,
  dayKey: string,
  body: string,
): Promise<SaveMyMoodResult> {
  if (!useFirestoreForUser(actorUserId)) {
    return memory.saveMyMoodForPair(actorUserId, pairId, dayKey, body);
  }
  return firestore.saveMyMoodForPair(actorUserId, pairId, dayKey, body);
}

export async function getMyWhisperForPair(
  actorUserId: string,
  pairId: string,
  dayKey: string,
): Promise<GetMyWhisperResult> {
  if (!useFirestoreForUser(actorUserId)) {
    return memory.getMyWhisperForPair(actorUserId, pairId, dayKey);
  }
  return firestore.getMyWhisperForPair(actorUserId, pairId, dayKey);
}

export async function saveMyWhisperForPair(
  actorUserId: string,
  pairId: string,
  dayKey: string,
  body: string,
): Promise<SaveMyWhisperResult> {
  if (!useFirestoreForUser(actorUserId)) {
    return memory.saveMyWhisperForPair(actorUserId, pairId, dayKey, body);
  }
  return firestore.saveMyWhisperForPair(actorUserId, pairId, dayKey, body);
}

export async function listNotificationsForActor(
  actorUserId: string,
  pairId: string,
): Promise<ListNotificationsResult> {
  if (!useFirestoreForUser(actorUserId)) {
    return memory.listNotificationsForActor(actorUserId, pairId);
  }
  return firestore.listNotificationsForActor(actorUserId, pairId);
}

export async function listChatMessagesForActor(
  actorUserId: string,
  pairId: string,
): Promise<ListChatMessagesResult> {
  if (!useFirestoreForUser(actorUserId)) {
    return memory.listChatMessagesForActor(actorUserId, pairId);
  }
  return firestore.listChatMessagesForActor(actorUserId, pairId);
}

export async function postChatMessageForActor(
  actorUserId: string,
  pairId: string,
  text: string,
  topicUserId: string | null,
): Promise<PostChatMessageResult> {
  if (!useFirestoreForUser(actorUserId)) {
    return await memory.postChatMessageForActor(actorUserId, pairId, text, topicUserId);
  }
  return firestore.postChatMessageForActor(actorUserId, pairId, text, topicUserId);
}
