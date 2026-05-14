/**
 * Phase 1: 運営お知らせのモック（ペアに依存しない）。
 */

export type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
};

const SEED: readonly AnnouncementItem[] = [
  {
    id: "ann_phase1_intro",
    title: "試運転のねらい",
    body: "いまは、画面の流れと言葉の置き方を確かめる段階です。急いで埋めなくて大丈夫です。",
    publishedAt: "2026-05-01T09:00:00.000Z",
  },
  {
    id: "ann_ui_pace",
    title: "画面の増え方について",
    body: "入口は少しずつ増えていきます。迷ったら、凪の入口へ戻っても構いません。",
    publishedAt: "2026-05-08T10:30:00.000Z",
  },
  {
    id: "ann_privacy_reminder",
    title: "今日のメモとひとりごとメモについて",
    body: "あなたが書いた文章そのものは、ペアのほかの人からは見えません。届くのは、あとからつくる要約だけです。",
    publishedAt: "2026-05-12T15:00:00.000Z",
  },
] as const;

export function listAnnouncementEntries(): AnnouncementItem[] {
  return SEED.map((a) => ({ ...a }));
}
