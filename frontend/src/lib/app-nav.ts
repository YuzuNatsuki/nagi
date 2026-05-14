export type AppNavItem = {
  to: string;
  label: string;
  /** NavLink の `end`（ホームだけ true） */
  end?: boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  { to: "/app", label: "ホーム", end: true },
  { to: "/app/mood", label: "今日のメモ" },
  { to: "/app/whisper", label: "ひとりごとメモ" },
  { to: "/app/chat", label: "凪に話す" },
  { to: "/app/notifications", label: "通知履歴" },
  { to: "/app/announcements", label: "お知らせ" },
  { to: "/app/members", label: "メンバー" },
  { to: "/app/pairs", label: "ペアの切替" },
  { to: "/app/settings", label: "設定" },
];
