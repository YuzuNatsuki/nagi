import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { MeResponse, PairSummary } from "../api/types.js";
import { RELATIONSHIP_TAG_OPTIONS } from "../domain/relationship-tags.js";
import { routeAfterMe } from "../lib/me-navigation.js";
import { useDevUser } from "../context/DevUserContext.js";

const NICKNAME_MAX_CHARS = 40;

function relationshipLabel(tag: PairSummary["relationshipTag"]): string {
  return RELATIONSHIP_TAG_OPTIONS.find((o) => o.id === tag)?.label ?? tag;
}

function roleLabel(role: PairSummary["yourRole"]): string {
  return role === "owner" ? "オーナー" : "メンバー";
}

function membershipLabel(state: PairSummary["membershipState"]): string {
  return state === "active" ? "参加済み" : "承認待ち";
}

export function AppSettingsPage(): ReactElement {
  const { api, apiUserReady, firebaseUid } = useDevUser();
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!apiUserReady) {
      setMe(null);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.request<MeResponse>("/api/me");
      if (res.pair === null) {
        setMe(null);
        navigate("/onboarding", { replace: true });
        return;
      }
      setMe(res);
    } catch (e) {
      setMe(null);
      setLoadError(e instanceof Error ? e.message : "読み取れませんでした");
    } finally {
      setLoading(false);
    }
  }, [api, navigate, apiUserReady, firebaseUid]);

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
        const m = await api.request<MeResponse>("/api/me");
        if (cancelled) {
          return;
        }
        if (m.pair === null) {
          navigate("/onboarding", { replace: true });
          return;
        }
        const next = routeAfterMe(m);
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

  useEffect(() => {
    if (me !== null) {
      setNicknameDraft(me.user.nickname ?? "");
    }
  }, [me]);

  const saveNickname = useCallback(async () => {
    if (!apiUserReady || me === null) {
      return;
    }
    setProfileSaving(true);
    setProfileMessage(null);
    try {
      const t = nicknameDraft.trim();
      const res = await api.putJson<MeResponse>("/api/me/profile", {
        nickname: t === "" ? null : t,
      });
      if (res.pair === null) {
        navigate("/onboarding", { replace: true });
        return;
      }
      setMe(res);
      setProfileMessage("保存しました");
    } catch (e) {
      setProfileMessage(e instanceof Error ? e.message : "保存できませんでした");
    } finally {
      setProfileSaving(false);
    }
  }, [api, apiUserReady, me, nicknameDraft, navigate]);

  const pair = me?.pair ?? null;
  const normalizedDraft = nicknameDraft.trim() === "" ? null : nicknameDraft.trim();
  const nicknameDirty = me !== null && normalizedDraft !== (me.user.nickname ?? null);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <p className="text-sm text-ink/60">凪</p>
      <h1 className="mt-3 font-serif text-2xl tracking-tight text-ink">設定</h1>
      <p className="mt-8 max-w-prose text-ink/80">
        いまの呼び名と、細かなところへ進む道しるべです。変更はそれぞれの画面から行えます。
      </p>

      {!apiUserReady ? (
        <p className="mt-10 max-w-prose text-sm text-ink/60">
          開発では、上のバーで利用者を選ぶと、内容が読み込まれます。
        </p>
      ) : null}

      {loading ? <p className="mt-10 text-sm text-ink/70">読み込み中です</p> : null}

      {loadError !== null ? (
        <p className="mt-10 text-sm text-indigo" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && apiUserReady && loadError === null && pair !== null ? (
        <div className="mt-10 space-y-10">
          <section aria-labelledby="settings-summary-heading">
            <h2 id="settings-summary-heading" className="text-sm font-medium text-ink/80">
              いまのかたち
            </h2>
            <dl className="mt-4 max-w-prose space-y-3 text-sm text-ink/80">
              <div>
                <dt className="text-xs text-ink/55">アプリでの表示名</dt>
                <dd className="mt-1 text-ink">{me?.user.displayName}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink/55">認証アカウントの表示名</dt>
                <dd className="mt-1 text-ink">{me?.user.authDisplayName}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink/55">ペアの呼び名</dt>
                <dd className="mt-1 text-ink">{pair.displayName}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink/55">関係性のタグ</dt>
                <dd className="mt-1 text-ink">{relationshipLabel(pair.relationshipTag)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink/55">このペアでの立場</dt>
                <dd className="mt-1 text-ink">{roleLabel(pair.yourRole)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink/55">参加の状態</dt>
                <dd className="mt-1 text-ink">{membershipLabel(pair.membershipState)}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="settings-nickname-heading" className="max-w-prose">
            <h2 id="settings-nickname-heading" className="text-sm font-medium text-ink/80">
              ニックネーム
            </h2>
            <p className="mt-3 text-sm text-ink/70">
              アプリ内であなたと呼ばれる名前です。空にして保存すると、認証アカウントの表示名に戻ります（最大{" "}
              {NICKNAME_MAX_CHARS} 文字）。
            </p>
            <label htmlFor="settings-nickname-input" className="mt-5 block text-xs text-ink/55">
              ニックネーム
            </label>
            <input
              id="settings-nickname-input"
              type="text"
              autoComplete="nickname"
              maxLength={NICKNAME_MAX_CHARS}
              value={nicknameDraft}
              onChange={(ev) => {
                setProfileMessage(null);
                setNicknameDraft(ev.target.value);
              }}
              className="mt-2 w-full max-w-md rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink shadow-sm outline-none transition-colors focus:border-indigo/40 focus:ring-1 focus:ring-indigo/30"
            />
            <p className="mt-1 text-xs text-ink/50">
              {nicknameDraft.length}/{NICKNAME_MAX_CHARS}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-md bg-indigo px-4 py-2 text-sm font-medium text-paper transition-opacity duration-500 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={profileSaving || !nicknameDirty}
                onClick={() => {
                  void saveNickname();
                }}
              >
                {profileSaving ? "保存中…" : "保存"}
              </button>
            </div>
            {profileMessage !== null ? (
              <p className="mt-3 text-sm text-ink/80" role="status">
                {profileMessage}
              </p>
            ) : null}
          </section>

          <section aria-labelledby="settings-links-heading">
            <h2 id="settings-links-heading" className="text-sm font-medium text-ink/80">
              開きたいところへ
            </h2>
            <ul className="mt-4 max-w-prose list-inside list-disc space-y-2 text-sm text-ink/75">
              <li>
                <Link
                  to="/app/members"
                  className="text-indigo underline decoration-indigo/30 underline-offset-4 transition-opacity duration-500 hover:opacity-80"
                >
                  メンバーとプライバシー
                </Link>
                <span className="text-ink/55">（人の一覧と、チャットの保持のしかた）</span>
              </li>
              <li>
                <Link
                  to="/app/pairs"
                  className="text-indigo underline decoration-indigo/30 underline-offset-4 transition-opacity duration-500 hover:opacity-80"
                >
                  ペアの切替
                </Link>
              </li>
              <li>
                <Link
                  to="/app/announcements"
                  className="text-indigo underline decoration-indigo/30 underline-offset-4 transition-opacity duration-500 hover:opacity-80"
                >
                  お知らせ
                </Link>
              </li>
              <li>
                <Link
                  to="/app/notifications"
                  className="text-indigo underline decoration-indigo/30 underline-offset-4 transition-opacity duration-500 hover:opacity-80"
                >
                  通知履歴
                </Link>
              </li>
            </ul>
          </section>

          <section aria-labelledby="settings-dev-heading">
            <h2 id="settings-dev-heading" className="text-sm font-medium text-ink/80">
              この試作版について
            </h2>
            <p className="mt-4 max-w-prose text-sm text-ink/65">
              画面上部の利用者の切替は、試作のためのものです。本番では、ここに置き換わる道のりを想定しています。
            </p>
          </section>
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
