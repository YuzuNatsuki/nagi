import { getFirestore } from "firebase-admin/firestore";
import type { AnnouncementItem } from "../in-memory/announcements-store.js";
import { ANNOUNCEMENT_SEED_ENTRIES } from "../in-memory/announcements-store.js";

/** 運営お知らせ（ペアに依存しないグローバルコレクション） */
const COLLECTION = "platformAnnouncements";

function db() {
  return getFirestore();
}

function docToItem(id: string, data: FirebaseFirestore.DocumentData): AnnouncementItem | null {
  const title = data.title;
  const body = data.body;
  const publishedAt = data.publishedAt;
  if (typeof title !== "string" || typeof body !== "string" || typeof publishedAt !== "string") {
    return null;
  }
  return { id, title, body, publishedAt };
}

/**
 * Firestore 上のお知らせを返す。コレクションが空、またはシード ID が欠けている場合は既定シードを書き込んで補完する。
 */
export async function listAnnouncementEntriesFirestore(): Promise<AnnouncementItem[]> {
  const col = db().collection(COLLECTION);
  let snap = await col.get();
  const existingIds = new Set(snap.docs.map((d) => d.id));
  const missingSeeds = ANNOUNCEMENT_SEED_ENTRIES.filter((s) => !existingIds.has(s.id));
  if (missingSeeds.length > 0) {
    const batch = db().batch();
    for (const s of missingSeeds) {
      batch.set(
        col.doc(s.id),
        { title: s.title, body: s.body, publishedAt: s.publishedAt },
        { merge: true },
      );
    }
    await batch.commit();
    snap = await col.get();
  }

  const out: AnnouncementItem[] = [];
  for (const d of snap.docs) {
    const item = docToItem(d.id, d.data());
    if (item !== null) {
      out.push(item);
    }
  }
  out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return out;
}
