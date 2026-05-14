import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { GetWhisperResponseBody, MeResponse, PutWhisperResponseBody } from "../api/types.js";
import { localCalendarDay } from "../lib/calendar-day.js";
import { routeAfterMe } from "../lib/me-navigation.js";
import { useDevUser } from "../context/DevUserContext.js";

function formatSavedAt(iso: string): string {
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

export function AppWhisperPage(): ReactElement {
  const { userId, api, apiUserReady, firebaseUid } = useDevUser();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => localCalendarDay());
  const [draft, setDraft] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState(false);

  const reload = useCallback(async () => {
    if (!apiUserReady) {
      setDraft("");
      setSavedAt(null);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const me = await api.request<MeResponse>("/api/me");
      if (me.pair === null) {
        setDraft("");
        setSavedAt(null);
        navigate("/onboarding", { replace: true });
        return;
      }
      const q = new URLSearchParams({ date: selectedDate });
      const res = await api.request<GetWhisperResponseBody>(
        `/api/pairs/${me.pair.id}/whisper?${q.toString()}`,
      );
      if (res.date !== selectedDate) {
        setSelectedDate(res.date);
      }
      if (res.whisper === null) {
        setDraft("");
        setSavedAt(null);
      } else {
        setDraft(res.whisper.body);
        setSavedAt(res.whisper.savedAt);
      }
    } catch (e) {
      setDraft("");
      setSavedAt(null);
      setLoadError(e instanceof Error ? e.message : "読み取れませんでした");
    } finally {
      setLoading(false);
    }
  }, [api, navigate, userId, firebaseUid, selectedDate]);

  useEffect(() => {
    void reload();
  }, [reload]);

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
  }, [api, navigate, userId, firebaseUid]);

  async function onSave(): Promise<void> {
    if (!apiUserReady) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSavedHint(false);
    try {
      const me = await api.request<MeResponse>("/api/me");
      if (me.pair === null) {
        navigate("/onboarding", { replace: true });
        return;
      }
      const res = await api.putJson<PutWhisperResponseBody>(`/api/pairs/${me.pair.id}/whisper`, {
        body: draft,
        date: selectedDate,
      });
      setDraft(res.whisper.body);
      setSavedAt(res.whisper.savedAt);
      setSavedHint(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存できませんでした");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <p className="text-sm text-ink/60">凪</p>
      <h1 className="mt-3 font-serif text-2xl tracking-tight text-ink">ひとりごとメモ</h1>
      <p className="mt-8 max-w-prose text-ink/80">
        声に出さないほうのメモです。日ごとに別のかたちで残ります。ペアのほかの人からは、本文そのものは見えません。
      </p>

      {!apiUserReady ? (
        <p className="mt-10 max-w-prose text-sm text-ink/60">
          開発では、上のバーで利用者を選ぶと、保存した内容が読み込まれます。
        </p>
      ) : null}

      {loading ? <p className="mt-10 text-sm text-ink/70">読み込み中です</p> : null}

      {loadError !== null ? (
        <p className="mt-10 text-sm text-indigo" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && apiUserReady && loadError === null ? (
        <div className="mt-10">
          <label htmlFor="whisper-date" className="block text-xs text-ink/60">
            書き留める日
          </label>
          <input
            id="whisper-date"
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSavedHint(false);
            }}
            className="mt-2 max-w-xs rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-indigo/40 focus:outline-none focus:ring-1 focus:ring-indigo/25"
          />
          <label htmlFor="whisper-body" className="sr-only">
            ひとりごとメモの文章
          </label>
          <textarea
            id="whisper-body"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setSavedHint(false);
            }}
            rows={10}
            className="mt-6 w-full resize-y rounded-lg border border-ink/15 bg-white px-4 py-4 text-sm leading-relaxed text-ink shadow-sm transition-opacity duration-500 placeholder:text-ink/35 focus:border-indigo/40 focus:outline-none focus:ring-1 focus:ring-indigo/25"
            placeholder="誰に向けたものでもなくて大丈夫です。一行だけでも、置いておけます。"
          />
          {savedAt !== null ? (
            <p className="mt-3 text-xs text-ink/55">前回の保存: {formatSavedAt(savedAt)}</p>
          ) : null}
          <div className="mt-6">
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSave()}
              className="inline-flex items-center justify-center rounded-lg bg-ink px-5 py-3 text-sm text-paper transition-opacity duration-500 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "保存しています" : "保存する"}
            </button>
            {savedHint ? <p className="mt-4 text-sm text-ink/70">保存しました</p> : null}
          </div>
          {saveError !== null ? (
            <p className="mt-4 text-sm text-indigo" role="alert">
              {saveError}
            </p>
          ) : null}
        </div>
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
