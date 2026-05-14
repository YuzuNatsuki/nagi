import type { FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { MeResponse, RedeemInviteRequestBody, RedeemInviteResponseBody } from "../api/types.js";
import { routeAfterMe } from "../lib/me-navigation.js";
import { useDevUser } from "../context/DevUserContext.js";

export function OnboardingEnterInvitePage(): ReactElement {
  const { userId, api, apiUserReady, firebaseUid } = useDevUser();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
        if (me.pair !== null) {
          navigate(routeAfterMe(me), { replace: true });
        }
      } catch {
        /* 401 などはこの画面のまま */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, navigate, userId, firebaseUid]);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);
    if (!apiUserReady) {
      setFormError("利用者がまだ選ばれていません");
      return;
    }
    setSubmitting(true);
    try {
      const body: RedeemInviteRequestBody = { code: code.trim() };
      await api.postJson<RedeemInviteResponseBody>("/api/invites/redeem", body);
      const me = await api.request<MeResponse>("/api/me");
      navigate(routeAfterMe(me), { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <p className="text-sm text-ink/60">はじまり</p>
      <h1 className="mt-3 font-serif text-2xl tracking-tight text-ink">招待コードを入れる</h1>
      <p className="mt-8 max-w-prose text-ink/80">
        届いたコードを、そのまま貼っても、少しずつ入れても大丈夫です。大文字と小文字は区別されます。
      </p>

      <form className="mt-12 space-y-8" onSubmit={(ev) => void onSubmit(ev)}>
        <div>
          <label className="block text-sm text-ink/80" htmlFor="invite-code">
            招待コード
          </label>
          <input
            id="invite-code"
            name="code"
            type="text"
            autoComplete="off"
            spellCheck={false}
            className="mt-3 w-full rounded-lg border border-ink/15 bg-white px-4 py-3 font-mono text-lg tracking-wide text-ink outline-none ring-indigo/30 focus:ring-2"
            value={code}
            onChange={(ev) => {
              setCode(ev.target.value);
            }}
            placeholder="例: abcdABCD2345"
          />
        </div>

        {formError !== null ? (
          <p className="text-sm text-indigo" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={submitting || code.trim() === ""}
            className="inline-flex items-center justify-center rounded-lg bg-ink px-6 py-3 text-sm text-paper transition-opacity duration-500 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "送っています" : "このコードで入る"}
          </button>
          <Link
            to="/onboarding"
            className="text-sm text-indigo underline decoration-indigo/30 underline-offset-4 transition-opacity duration-500 hover:opacity-80"
          >
            はじまりに戻る
          </Link>
        </div>
      </form>
    </main>
  );
}
