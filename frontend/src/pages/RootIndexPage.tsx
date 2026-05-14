import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { MeResponse } from "../api/types.js";
import { useAuth } from "../context/AuthContext.js";
import { useDevUser } from "../context/DevUserContext.js";
import { routeAfterMe } from "../lib/me-navigation.js";

type GateState = "idle_no_user" | "loading" | "fallback";

export function RootIndexPage(): ReactElement {
  const { api, apiUserReady, firebaseUid } = useDevUser();
  const { firebaseEnabled, authReady } = useAuth();
  const navigate = useNavigate();
  const [gate, setGate] = useState<GateState>("idle_no_user");

  useEffect(() => {
    if (firebaseEnabled && !authReady) {
      return;
    }

    if (!apiUserReady) {
      setGate("idle_no_user");
      return;
    }

    let cancelled = false;
    setGate("loading");
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
        navigate(routeAfterMe(me), { replace: true });
      } catch {
        if (!cancelled) {
          setGate("fallback");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, navigate, apiUserReady, firebaseUid, firebaseEnabled, authReady]);

  if (firebaseEnabled && !authReady) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
        <p className="text-ink/70">つながっています</p>
      </main>
    );
  }

  if (gate === "loading") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
        <p className="text-ink/70">つながっています</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <h1 className="font-serif text-2xl tracking-tight text-ink">凪</h1>
      <p className="mt-8 max-w-prose text-ink/80">
        AI が、あなたに、大切な人について、短い気づきを届ける場所です。
      </p>
      {gate === "idle_no_user" ? (
        <>
          <p className="mt-6 max-w-prose text-sm text-ink/60">
            {firebaseEnabled
              ? "メールでログインするか、開発用の利用者を選ぶと、ペアの有無に応じて次の画面へ移ります。"
              : "開発では、上のバーで利用者を選ぶと、ペアの有無に応じて次の画面へ移ります。"}
          </p>
          {firebaseEnabled ? (
            <p className="mt-4 text-sm text-ink/80">
              <Link to="/sign-in" className="text-indigo underline underline-offset-4">
                メールでログイン
              </Link>
              <span className="text-ink/40"> · </span>
              <Link to="/sign-up" className="text-indigo underline underline-offset-4">
                新規登録
              </Link>
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-6 max-w-prose text-sm text-ink/60">状態を読み取れませんでした。</p>
      )}
    </main>
  );
}
