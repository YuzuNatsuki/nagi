import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { MeResponse } from "../api/types.js";
import { routeAfterMe } from "../lib/me-navigation.js";
import { useDevUser } from "../context/DevUserContext.js";

export function OnboardingPendingApprovalPage(): ReactElement {
  const { userId, api } = useDevUser();
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId === null) {
      setMe(null);
      setError(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.request<MeResponse>("/api/me");
        if (cancelled) {
          return;
        }
        setMe(data);
        if (data.pair === null) {
          navigate("/onboarding", { replace: true });
          return;
        }
        if (data.pair.membershipState !== "pending_owner_approval") {
          navigate(routeAfterMe(data), { replace: true });
        }
      } catch (e) {
        if (!cancelled) {
          setMe(null);
          setError(e instanceof Error ? e.message : "読み取れませんでした");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, navigate, userId]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <p className="text-sm text-ink/60">はじまり</p>
      <h1 className="mt-3 font-serif text-2xl tracking-tight text-ink">承認待ち</h1>
      <p className="mt-8 max-w-prose text-ink/80">
        いまは、ペアのオーナー側の確認待ちです。通知が届く前提にはせず、落ち着いたタイミングで見てもらえれば十分です。
      </p>

      {userId === null ? (
        <p className="mt-10 max-w-prose text-sm text-ink/60">
          開発では、上のバーで利用者を選ぶと、状態が読み込まれます。
        </p>
      ) : null}

      {error !== null ? (
        <p className="mt-10 text-sm text-indigo" role="alert">
          {error}
        </p>
      ) : null}

      {me !== null &&
      me.pair !== null &&
      me.pair.membershipState === "pending_owner_approval" ? (
        <div className="mt-10 rounded-lg border border-ink/10 bg-white px-5 py-5">
          <p className="text-xs text-ink/60">ペアの表示名</p>
          <p className="mt-2 font-serif text-lg text-ink">{me.pair.displayName}</p>
        </div>
      ) : null}

      <p className="mt-14">
        <Link
          to="/onboarding"
          className="text-sm text-indigo underline decoration-indigo/30 underline-offset-4 transition-opacity duration-500 hover:opacity-80"
        >
          はじまりに戻る
        </Link>
      </p>
    </main>
  );
}
