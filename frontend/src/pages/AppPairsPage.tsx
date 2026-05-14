import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { MePairsResponseBody, MeResponse, PairSummary, PutActivePairResponseBody } from "../api/types.js";
import { routeAfterMe } from "../lib/me-navigation.js";
import { useDevUser } from "../context/DevUserContext.js";

function roleLabel(role: PairSummary["yourRole"]): string {
  return role === "owner" ? "オーナー" : "メンバー";
}

function stateLabel(state: PairSummary["membershipState"]): string {
  return state === "active" ? "参加済み" : "承認待ち";
}

export function AppPairsPage(): ReactElement {
  const { userId, api, apiUserReady, firebaseUid } = useDevUser();
  const navigate = useNavigate();
  const [rows, setRows] = useState<PairSummary[]>([]);
  const [activePairId, setActivePairId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyPairId, setBusyPairId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!apiUserReady) {
      setRows([]);
      setActivePairId(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.request<MePairsResponseBody>("/api/me/pairs");
      setRows(data.pairs);
      setActivePairId(data.activePairId);
    } catch (e) {
      setRows([]);
      setActivePairId(null);
      setError(e instanceof Error ? e.message : "読み取れませんでした");
    } finally {
      setLoading(false);
    }
  }, [api, userId, firebaseUid]);

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

  const onSelect = useCallback(
    async (pairId: string) => {
      if (pairId === activePairId) {
        navigate("/app");
        return;
      }
      setBusyPairId(pairId);
      setError(null);
      try {
        const res = await api.putJson<PutActivePairResponseBody>("/api/me/active-pair", { pairId });
        setActivePairId(res.pair.id);
        navigate("/app");
      } catch (e) {
        setError(e instanceof Error ? e.message : "切り替えられませんでした");
      } finally {
        setBusyPairId(null);
      }
    },
    [activePairId, api, navigate],
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <p className="text-sm text-ink/60">凪</p>
      <h1 className="mt-3 font-serif text-2xl tracking-tight text-ink">ペアの切替</h1>
      <p className="mt-8 max-w-prose text-ink/80">
        いま開いているペアだけが、あとから置く入口の前提になります。切り替えは、落ち着いたタイミングで十分です。
      </p>

      {!apiUserReady ? (
        <p className="mt-10 max-w-prose text-sm text-ink/60">
          開発では、上のバーで利用者を選ぶと、一覧が読み込まれます。
        </p>
      ) : null}

      {loading ? <p className="mt-10 text-sm text-ink/70">読み込み中です</p> : null}

      {error !== null ? (
        <p className="mt-10 text-sm text-indigo" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && apiUserReady && rows.length === 0 && error === null ? (
        <p className="mt-10 max-w-prose text-sm text-ink/70">
          まだペアがありません。{" "}
          <Link
            to="/onboarding"
            className="text-indigo underline decoration-indigo/30 underline-offset-4 transition-opacity duration-500 hover:opacity-80"
          >
            はじまりへ
          </Link>
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="mt-10 space-y-4">
          {rows.map((p) => {
            const isActive = p.id === activePairId;
            return (
              <li
                key={p.id}
                className={`rounded-lg border px-5 py-5 transition-opacity duration-500 ${
                  isActive ? "border-indigo/40 bg-white ring-1 ring-indigo/20" : "border-ink/10 bg-white"
                }`}
              >
                <p className="font-serif text-lg text-ink">{p.displayName}</p>
                <p className="mt-2 text-xs text-ink/55">
                  {roleLabel(p.yourRole)}・{stateLabel(p.membershipState)}
                </p>
                <div className="mt-5">
                  <button
                    type="button"
                    disabled={busyPairId !== null}
                    onClick={() => void onSelect(p.id)}
                    className="inline-flex items-center justify-center rounded-lg bg-ink px-5 py-3 text-sm text-paper transition-opacity duration-500 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isActive ? "凪へ戻る" : "このペアで続ける"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
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
