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
  const { api, apiUserReady, firebaseUid } = useDevUser();
  const navigate = useNavigate();
  const [rows, setRows] = useState<NotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserNote, setBrowserNote] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!apiUserReady) {
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
  }, [api, navigate, apiUserReady, firebaseUid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const tryBrowserNotification = useCallback(async () => {
    setBrowserNote(null);
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setBrowserNote("この環境では、ブラウザ通知を試せません。");
      return;
    }
    try {
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      if (permission !== "granted") {
        setBrowserNote("通知がオフのままです。ブラウザの設定から許可できる場合があります。");
        return;
      }
      const first = rows[0];
      const body =
        first !== undefined
          ? `${first.headline} のかたちだけを、短く試し表示しています。`
          : "凪からの試し通知です。本文そのものの保存ではありません。";
      new Notification("凪", { body, lang: "ja" });
      setBrowserNote("試し通知を送りました。見えない場合は、集中モードなどを確認してください。");
    } catch (e) {
      setBrowserNote(e instanceof Error ? e.message : "通知を送れませんでした");
    }
  }, [rows]);

  useEffect(() => {
    if (!apiUserReady) {
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
  }, [api, navigate, apiUserReady, firebaseUid]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <p className="text-sm text-ink/60">凪</p>
      <h1 className="mt-3 font-serif text-2xl tracking-tight text-ink">通知履歴</h1>
      <p className="mt-8 max-w-prose text-ink/80">
        届いたメッセージのかたちだけが並びます。今日のメモやひとりごとメモの本文そのものは、ここには出しません。
      </p>

      {apiUserReady ? (
        <section className="mt-10 rounded-lg border border-ink/10 bg-white px-5 py-5" aria-label="ブラウザ通知の試行">
          <h2 className="font-serif text-lg text-ink">ブラウザ通知の確認</h2>
          <p className="mt-3 max-w-prose text-sm text-ink/80">
            Phase 1 では、端末の通知欄に届くかどうかだけを確かめます。本番の配送とは別経路です。
          </p>
          <button
            type="button"
            className="mt-4 rounded-md border border-ink/15 bg-white px-4 py-2 text-sm text-ink transition-opacity duration-500 hover:opacity-80"
            onClick={() => void tryBrowserNotification()}
          >
            ブラウザ通知を試す
          </button>
          {browserNote !== null ? (
            <p className="mt-3 max-w-prose text-sm text-ink/70" role="status">
              {browserNote}
            </p>
          ) : null}
        </section>
      ) : null}

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
        <p className="mt-10 max-w-prose text-sm text-ink/70">いまは、表示できる通知がありません。</p>
      ) : null}

      {!loading && apiUserReady && error === null && rows.length > 0 ? (
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
