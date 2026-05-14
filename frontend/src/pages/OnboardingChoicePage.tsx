import type { ReactElement } from "react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { MeResponse } from "../api/types.js";
import { routeAfterMe } from "../lib/me-navigation.js";
import { useDevUser } from "../context/DevUserContext.js";

export function OnboardingChoicePage(): ReactElement {
  const { api, apiUserReady, firebaseUid } = useDevUser();
  const navigate = useNavigate();

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
  }, [api, navigate, apiUserReady, firebaseUid]);

  const canNavigate = apiUserReady;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <p className="text-sm text-ink/60">はじまり</p>
      <h1 className="mt-3 font-serif text-2xl tracking-tight text-ink">ペアがまだありません</h1>
      <p className="mt-8 max-w-prose text-ink/80">
        凪は共有のペアのなかで動きます。入口は次の二つだけです。
      </p>

      <ul className="mt-12 flex flex-col gap-6">
        <li>
          <Link
            to="/onboarding/create-pair"
            className="block rounded-lg border border-ink/10 bg-white px-6 py-6 text-ink shadow-sm ring-indigo/20 transition-opacity duration-500 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40"
            aria-disabled={!canNavigate}
            onClick={(e) => {
              if (!canNavigate) {
                e.preventDefault();
              }
            }}
          >
            <span className="font-serif text-lg text-ink">ペアをつくる</span>
            <span className="mt-2 block text-sm text-ink/70">関係性のタグと表示名から始めます。</span>
          </Link>
        </li>
        <li>
          <Link
            to="/onboarding/enter-invite"
            className="block rounded-lg border border-ink/10 bg-white px-6 py-6 text-ink shadow-sm ring-indigo/20 transition-opacity duration-500 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40"
            aria-disabled={!canNavigate}
            onClick={(e) => {
              if (!canNavigate) {
                e.preventDefault();
              }
            }}
          >
            <span className="font-serif text-lg text-ink">招待コードを入れる</span>
            <span className="mt-2 block text-sm text-ink/70">すでにあるペアへ、コードから入ります。</span>
          </Link>
        </li>
      </ul>

      {!apiUserReady ? (
        <p className="mt-10 max-w-prose text-sm text-ink/60">
          開発では、上のバーで利用者を選ぶと、この先の画面へ進めます。
        </p>
      ) : null}
    </main>
  );
}
