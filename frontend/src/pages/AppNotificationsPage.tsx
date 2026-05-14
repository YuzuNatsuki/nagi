import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { MeResponse, NotificationHistoryItem, NotificationHistoryResponseBody } from "../api/types.js";
import { routeAfterMe } from "../lib/me-navigation.js";
import { useDevUser } from "../context/DevUserContext.js";

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

export function AppNotificationsPage(): ReactElement {
  const { userId, api } = useDevUser();
  const navigate = useNavigate();
  const [rows, setRows] = useState<NotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (userId === null) {
      setRows([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const me = await api.request<MeResponse>("/api/me");
      if (me.pair === null) {
        setRows([]);
        navigate("/onboarding", { replace: true });
        return;
      }
      const res = await api.request<NotificationHistoryResponseBody>(
        `/api/pairs/${me.pair.id}/notifications`,
      );
      setRows(res.notifications);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "読み取れませんでした");
    } finally {
      setLoading(false);
    }
  }, [api, navigate, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (userId === null) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const me = await api.request<MeResponse>("/api/me");
        if (cancelled) {
          return;
        }
        if (me.pair === null) {
          navigate("/onboarding", { replace: true });
          return;
        }
        const next = routeAfterMe(me);
        if (next !== "/app") {
          navigate(next, { replace: true });
        }
      } catch {
        /* 401 などはこの画面のまま */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, navigate, userId]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <p className="text-sm text-ink/60">凪</p>
      <h1 className="mt-3 font-serif text-2xl tracking-tight text-ink">通知履歴</h1>
      <p className="mt-8 max-w-prose text-ink/80">
        届いたメッセージのかたちだけが並びます。今日のメモやひとりごとメモの本文そのものは、ここには出しません。
      </p>

      {userId === null ? (
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

      {!loading && userId !== null && error === null && rows.length === 0 ? (
        <p className="mt-10 max-w-prose text-sm text-ink/70">いまは、表示できる通知がありません。</p>
      ) : null}

      {!loading && userId !== null && error === null && rows.length > 0 ? (
        <ul className="mt-10 space-y-6">
          {rows.map((n) => (
            <li key={n.id} className="rounded-lg border border-ink/10 bg-white px-5 py-5">
              <p className="text-xs text-ink/55">{formatWhen(n.createdAt)}</p>
              <h2 className="mt-2 font-serif text-lg text-ink">{n.headline}</h2>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink/85">{n.body}</p>
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
