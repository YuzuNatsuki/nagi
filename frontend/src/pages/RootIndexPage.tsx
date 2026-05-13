import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MeResponse } from "../api/types.js";
import { routeAfterMe } from "../lib/me-navigation.js";
import { useDevUser } from "../context/DevUserContext.js";

type GateState = "idle_no_user" | "loading" | "fallback";

export function RootIndexPage(): ReactElement {
  const { userId, api } = useDevUser();
  const navigate = useNavigate();
  const [gate, setGate] = useState<GateState>("idle_no_user");

  useEffect(() => {
    if (userId === null) {
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
  }, [api, navigate, userId]);

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
        <p className="mt-6 max-w-prose text-sm text-ink/60">
          開発では、上のバーで利用者を選ぶと、ペアの有無に応じて次の画面へ移ります。
        </p>
      ) : (
        <p className="mt-6 max-w-prose text-sm text-ink/60">状態を読み取れませんでした。</p>
      )}
    </main>
  );
}
