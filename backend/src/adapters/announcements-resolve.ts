import { listAnnouncementEntriesFirestore } from "./firestore/announcements-store-firestore.js";
import { isFirestorePairsPersistenceActive } from "./firestore/pair-store-persistence.js";
import type { AnnouncementItem } from "./in-memory/announcements-store.js";
import { listAnnouncementEntries } from "./in-memory/announcements-store.js";

/**
 * GET /announcements 用。Firestore ペア永続化が有効なら DB を正とし、失敗時はメモリのシードにフォールバックする。
 */
export async function listAnnouncementsForApi(): Promise<AnnouncementItem[]> {
  if (!isFirestorePairsPersistenceActive()) {
    return listAnnouncementEntries();
  }
  try {
    return await listAnnouncementEntriesFirestore();
  } catch (e) {
    console.warn("listAnnouncementEntriesFirestore", e);
    return listAnnouncementEntries();
  }
}
