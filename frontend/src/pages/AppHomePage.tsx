import type { ReactElement } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { MeResponse } from "../api/types.js";
import { routeAfterMe } from "../lib/me-navigation.js";
import { useDevUser } from "../context/DevUserContext.js";

export function AppHomePage(): ReactElement {
  const { userId, api } = useDevUser();
  const navigate = useNavigate();

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

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <h1 className="font-serif text-2xl tracking-tight text-ink">凪</h1>
      <p className="mt-8 max-w-prose text-ink/80">ペアにつながっています。</p>
      <p className="mt-6 max-w-prose text-sm text-ink/60">
        このあと、ここに日々の入口（Mood や通知）が置かれます。
      </p>
    </main>
  );
}
