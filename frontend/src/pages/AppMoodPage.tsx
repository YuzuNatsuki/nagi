import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  GetMoodResponseBody,
  MeResponse,
  MoodDailyPromptResponseBody,
  PostMoodDailyChoiceResponseBody,
  PutMoodResponseBody,
} from "../api/types.js";
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

export function AppMoodPage(): ReactElement {
  const { api, apiUserReady, firebaseUid } = useDevUser();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => localCalendarDay());
  const [draft, setDraft] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState(false);
  const [dailyPrompt, setDailyPrompt] = useState<MoodDailyPromptResponseBody | null>(null);
  const [dailyPromptError, setDailyPromptError] = useState<string | null>(null);
  const [dailyChoiceBusy, setDailyChoiceBusy] = useState(false);
  const [dailyFeedback, setDailyFeedback] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!apiUserReady) {
      setDraft("");
      setSavedAt(null);
      setLoadError(null);
      setDailyPrompt(null);
      setDailyPromptError(null);
      setDailyFeedback(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setDailyPromptError(null);
    setDailyFeedback(null);
    try {
      const me = await api.request<MeResponse>("/api/me");
      if (me.pair === null) {
        setDraft("");
        setSavedAt(null);
        setDailyPrompt(null);
        navigate("/onboarding", { replace: true });
        return;
      }
      const q = new URLSearchParams({ date: selectedDate });
      const moodUrl = `/api/pairs/${me.pair.id}/mood?${q.toString()}`;
      const promptUrl = `/api/pairs/${me.pair.id}/mood/daily-prompt?${q.toString()}`;

      const res = await api.request<GetMoodResponseBody>(moodUrl);
      if (res.date !== selectedDate) {
        setSelectedDate(res.date);
      }
      if (res.mood === null) {
        setDraft("");
        setSavedAt(null);
      } else {
        setDraft(res.mood.body);
        setSavedAt(res.mood.savedAt);
      }

      try {
        const pr = await api.request<MoodDailyPromptResponseBody>(promptUrl);
        setDailyPrompt(pr);
      } catch (pe) {
        setDailyPrompt(null);
        setDailyPromptError(pe instanceof Error ? pe.message : "質問を読み取れませんでした");
      }
    } catch (e) {
      setDraft("");
      setSavedAt(null);
      setDailyPrompt(null);
      setLoadError(e instanceof Error ? e.message : "読み取れませんでした");
    } finally {
      setLoading(false);
    }
  }, [api, navigate, apiUserReady, firebaseUid, selectedDate]);

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
  }, [api, navigate, apiUserReady, firebaseUid]);

  async function onSave(): Promise<void> {
    if (!apiUserReady) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSavedHint(false);
    setDailyFeedback(null);
    try {
      const me = await api.request<MeResponse>("/api/me");
      if (me.pair === null) {
        navigate("/onboarding", { replace: true });
        return;
      }
      const res = await api.putJson<PutMoodResponseBody>(`/api/pairs/${me.pair.id}/mood`, {
        body: draft,
        date: selectedDate,
      });
      setDraft(res.mood.body);
      setSavedAt(res.mood.savedAt);
      setSavedHint(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存できませんでした");
    } finally {
      setSaving(false);
    }
  }

  async function onDailyChoice(choiceId: string): Promise<void> {
    if (!apiUserReady) {
      return;
    }
    setDailyChoiceBusy(true);
    setSaveError(null);
    setSavedHint(false);
    setDailyFeedback(null);
    try {
      const me = await api.request<MeResponse>("/api/me");
      if (me.pair === null) {
        navigate("/onboarding", { replace: true });
        return;
      }
      const res = await api.postJson<PostMoodDailyChoiceResponseBody>(`/api/pairs/${me.pair.id}/mood/daily-choice`, {
        date: selectedDate,
        choiceId,
      });
      setDraft(res.mood.body);
      setSavedAt(res.mood.savedAt);
      setDailyFeedback("質問への答えを、その日のメモに追記しました。");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "追記できませんでした");
    } finally {
      setDailyChoiceBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <p className="text-sm text-ink/60">凪</p>
      <h1 className="mt-3 font-serif text-2xl tracking-tight text-ink">今日のメモ</h1>
      <p className="mt-8 max-w-prose text-ink/80">
        いまの気持ちや体調を、日ごとに残す場所です。下の質問に、ボタンだけで答えて追記することもできます。ペアのほかの人からは、本文そのものは見えません。
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
          <label htmlFor="mood-date" className="block text-xs text-ink/60">
            書き留める日
          </label>
          <input
            id="mood-date"
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSavedHint(false);
              setDailyFeedback(null);
            }}
            className="mt-2 max-w-xs rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-indigo/40 focus:outline-none focus:ring-1 focus:ring-indigo/25"
          />

          {dailyPrompt !== null ? (
            <section className="mt-10 rounded-xl border border-ink/10 bg-white p-5 shadow-sm" aria-labelledby="daily-prompt-heading">
              <h2 id="daily-prompt-heading" className="text-sm font-medium text-ink">
                きょうの質問（タップだけで追記）
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink/85">{dailyPrompt.question}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {dailyPrompt.choices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={dailyChoiceBusy}
                    onClick={() => void onDailyChoice(c.id)}
                    className="rounded-lg border border-ink/15 bg-paper px-4 py-2.5 text-sm text-ink transition hover:border-indigo/35 hover:bg-indigo/5 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink/55">
                Phase 1 ではダミーの質問です。選んだ答えが一行としてメモに足され、すぐ保存されます。
              </p>
            </section>
          ) : null}

          {dailyPromptError !== null ? (
            <p className="mt-4 text-sm text-indigo" role="status">
              {dailyPromptError}
            </p>
          ) : null}

          {dailyFeedback !== null ? (
            <p className="mt-4 text-sm text-ink/75" role="status">
              {dailyFeedback}
            </p>
          ) : null}

          <label htmlFor="mood-body" className="mt-10 block text-xs text-ink/60">
            メモの本文（手入力でも追記できます）
          </label>
          <textarea
            id="mood-body"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setSavedHint(false);
              setDailyFeedback(null);
            }}
            rows={10}
            className="mt-2 w-full resize-y rounded-lg border border-ink/15 bg-white px-4 py-4 text-sm leading-relaxed text-ink shadow-sm transition-opacity duration-500 placeholder:text-ink/35 focus:border-indigo/40 focus:outline-none focus:ring-1 focus:ring-indigo/25"
            placeholder="ことばにならなくても大丈夫です。短くても、長くても、いまの輪郭だけで十分です。"
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
