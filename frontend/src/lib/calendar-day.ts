/** ローカルタイムゾーンの暦日 YYYY-MM-DD（今日のメモ / ひとりごとメモのキーに使う） */
export function localCalendarDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
