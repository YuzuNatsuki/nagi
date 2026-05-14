import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  ChatRetentionChoice,
  MeResponse,
  PairMemberRow,
  PairMembersResponseBody,
  PairPrivacyResponseBody,
} from "../api/types.js";
import { routeAfterMe } from "../lib/me-navigation.js";
import { useDevUser } from "../context/DevUserContext.js";

function roleLabel(role: PairMemberRow["role"]): string {
  return role === "owner" ? "オーナー" : "メンバー";
}

function stateLabel(state: PairMemberRow["membershipState"]): string {
  return state === "active" ? "参加済み" : "承認待ち";
}

const retentionChoices: { value: ChatRetentionChoice; title: string; note: string }[] = [
  {
    value: "none",
    title: "保持しない",
    note: "端末を閉じたあとも、本文は残しません。",
  },
  {
    value: "30days",
    title: "30日",
    note: "既定に近い置き方です。",
  },
  {
    value: "90days",
    title: "90日",
    note: "少し長めに残します。",
  },
];

export function AppMembersPage(): ReactElement {
  const { userId, api } = useDevUser();
  const navigate = useNavigate();
  const [members, setMembers] = useState<PairMembersResponseBody["members"]>([]);
  const [chatRetention, setChatRetention] = useState<ChatRetentionChoice>("30days");
  const [draftRetention, setDraftRetention] = useState<ChatRetentionChoice>("30days");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState(false);

  const reload = useCallback(async () => {
    if (userId === null) {
      setMembers([]);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const me = await api.request<MeResponse>("/api/me");
      if (me.pair === null) {
        setMembers([]);
        setLoadError(null);
        navigate("/onboarding", { replace: true });
        return;
      }
      const pairId = me.pair.id;
      const [mRes, pRes] = await Promise.all([
        api.request<PairMembersResponseBody>(`/api/pairs/${pairId}/members`),
        api.request<PairPrivacyResponseBody>(`/api/pairs/${pairId}/settings/privacy`),
      ]);
      setMembers(mRes.members);
      setChatRetention(pRes.chatRetention);
      setDraftRetention(pRes.chatRetention);
    } catch (e) {
      setMembers([]);
      setLoadError(e instanceof Error ? e.message : "読み取れませんでした");
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

  async function onSave(): Promise<void> {
    if (userId === null) {
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
      const res = await api.putJson<PairPrivacyResponseBody>(`/api/pairs/${me.pair.id}/settings/privacy`, {
        chatRetention: draftRetention,
      });
      setChatRetention(res.chatRetention);
      setDraftRetention(res.chatRetention);
      setSavedHint(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存できませんでした");
    } finally {
      setSaving(false);
    }
  }

  const dirty = draftRetention !== chatRetention;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <p className="text-sm text-ink/60">凪</p>
      <h1 className="mt-3 font-serif text-2xl tracking-tight text-ink">メンバーとプライバシー</h1>
      <p className="mt-8 max-w-prose text-ink/80">
        いま開いているペアの人たちと、あなただけの保存のしかたです。迷ったら、あとから変えても大丈夫です。
      </p>

      {userId === null ? (
        <p className="mt-10 max-w-prose text-sm text-ink/60">
          開発では、上のバーで利用者を選ぶと、一覧が読み込まれます。
        </p>
      ) : null}

      {loading ? <p className="mt-10 text-sm text-ink/70">読み込み中です</p> : null}

      {loadError !== null ? (
        <p className="mt-10 text-sm text-indigo" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && userId !== null && loadError === null ? (
        <>
          <section className="mt-12">
            <h2 className="font-serif text-lg text-ink">このペアの人たち</h2>
            {members.length === 0 ? (
              <p className="mt-4 text-sm text-ink/70">まだ、表示できる人がいません。</p>
            ) : (
              <ul className="mt-6 space-y-4">
                {members.map((m) => (
                  <li
                    key={m.userId}
                    className="rounded-lg border border-ink/10 bg-white px-5 py-5"
                  >
                    <p className="font-serif text-lg text-ink">{m.displayName}</p>
                    <p className="mt-2 text-xs text-ink/55">
                      {roleLabel(m.role)}・{stateLabel(m.membershipState)}
                    </p>
                    <p className="mt-2 text-xs text-ink/45">利用者ID: {m.userId}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-14">
            <h2 className="font-serif text-lg text-ink">今日のメモとひとりごとメモについて</h2>
            <p className="mt-4 max-w-prose text-sm text-ink/80">
              文章そのものは、ペアのほかの人からは見えません。日ごとに、それぞれの文章を残せます。届くのは、あとからつくる要約だけです。
            </p>
          </section>

          <section className="mt-14">
            <h2 className="font-serif text-lg text-ink">凪に話す（チャット）の履歴</h2>
            <p className="mt-4 max-w-prose text-sm text-ink/80">
              あなたの端末側の置き方です。ほかの人の画面とは別です。
            </p>
            <fieldset className="mt-6 space-y-4">
              <legend className="sr-only">チャット履歴の保持期間</legend>
              {retentionChoices.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer gap-3 rounded-lg border border-ink/10 bg-white px-4 py-4 transition-opacity duration-500 hover:border-ink/20"
                >
                  <input
                    type="radio"
                    name="chatRetention"
                    value={opt.value}
                    checked={draftRetention === opt.value}
                    onChange={() => {
                      setDraftRetention(opt.value);
                      setSavedHint(false);
                    }}
                    className="mt-1 h-4 w-4 border-ink/30 text-indigo focus:ring-indigo/40"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">{opt.title}</span>
                    <span className="mt-1 block text-xs text-ink/60">{opt.note}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                disabled={saving || !dirty}
                onClick={() => void onSave()}
                className="inline-flex items-center justify-center rounded-lg bg-ink px-5 py-3 text-sm text-paper transition-opacity duration-500 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "保存しています" : "保存する"}
              </button>
              {savedHint && !dirty ? <p className="text-sm text-ink/70">保存しました</p> : null}
            </div>
            {saveError !== null ? (
              <p className="mt-4 text-sm text-indigo" role="alert">
                {saveError}
              </p>
            ) : null}
          </section>
        </>
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
