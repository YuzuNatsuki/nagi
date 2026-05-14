import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AnnouncementItem, AnnouncementsResponseBody } from "../api/types.js";
import { useDevUser } from "../context/DevUserContext.js";

function formatPublished(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
    }).format(d);
  } catch {
    return iso;
  }
}

export function AppAnnouncementsPage(): ReactElement {
  const { api, apiUserReady, firebaseUid } = useDevUser();
  const [rows, setRows] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!apiUserReady) {
      setRows([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.request<AnnouncementsResponseBody>("/api/announcements");
      setRows(res.announcements);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "読み取れませんでした");
    } finally {
      setLoading(false);
    }
  }, [api, apiUserReady, firebaseUid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <p className="text-sm text-ink/60">凪</p>
      <h1 className="mt-3 font-serif text-2xl tracking-tight text-ink">お知らせ</h1>
      <p className="mt-8 max-w-prose text-ink/80">
        運営からの短い便りです。ペアの有無とは別に、同じ内容が届きます。
      </p>

      {!apiUserReady ? (
        <p className="mt-10 max-w-prose text-sm text-ink/60">
          開発では、上のバーで利用者を選ぶと、一覧が読み込まれます。
        </p>
      ) : null}

      {loading ? <p className="mt-10 text-sm text-ink/70">読み込み中です</p> : null}

      {error !== null ? (
        <p className="mt-10 text-sm text-indigo" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && apiUserReady && error === null && rows.length === 0 ? (
        <p className="mt-10 max-w-prose text-sm text-ink/70">いまは、表示できるお知らせがありません。</p>
      ) : null}

      {!loading && apiUserReady && error === null && rows.length > 0 ? (
        <ul className="mt-10 space-y-8">
          {rows.map((a) => (
            <li key={a.id} className="rounded-lg border border-ink/10 bg-white px-5 py-5">
              <p className="text-xs text-ink/55">{formatPublished(a.publishedAt)}</p>
              <h2 className="mt-2 font-serif text-lg text-ink">{a.title}</h2>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink/85">{a.body}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-14">
        <Link
          to="/app"
          className="text-sm text-indigo underline decoration-indigo/30 underline-offset-4 transition-opacity duration-500 hover:opacity-80"
        >
          凪へ戻る
        </Link>
      </p>
    </main>
  );
}
