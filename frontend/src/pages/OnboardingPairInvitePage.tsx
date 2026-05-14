import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { MeResponse, PairInviteResponseBody } from "../api/types.js";
import { useDevUser } from "../context/DevUserContext.js";

function formatExpiresAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
}

export function OnboardingPairInvitePage(): ReactElement {
  const { pairId } = useParams();
  const { api, apiUserReady, firebaseUid } = useDevUser();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [data, setData] = useState<PairInviteResponseBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");

  useEffect(() => {
    if (!apiUserReady) {
      setMe(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const meNow = await api.request<MeResponse>("/api/me");
        if (!cancelled) {
          setMe(meNow);
        }
      } catch {
        if (!cancelled) {
          setMe(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, apiUserReady, firebaseUid]);

  useEffect(() => {
    if (pairId === undefined || pairId === "") {
      setError("ペアが見つかりません");
      return;
    }
    if (!apiUserReady) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await api.request<PairInviteResponseBody>(`/api/pairs/${pairId}/invite`);
        if (!cancelled) {
          setData(res);
        }
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : "読み取れませんでした");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, pairId, apiUserReady, firebaseUid]);

  const onCopy = useCallback(async () => {
    if (data === null) {
      return;
    }
    setCopyState("idle");
    try {
      await navigator.clipboard.writeText(data.code);
      setCopyState("done");
    } catch {
      setCopyState("failed");
    }
  }, [data]);

  const onShare = useCallback(async () => {
    if (data === null) {
      return;
    }
    if (!navigator.share) {
      return;
    }
    const text = `凪の招待コード: ${data.code}\n有効期限の目安: ${formatExpiresAt(data.expiresAt)}`;
    try {
      await navigator.share({ title: "凪", text });
    } catch {
      /* 共有を閉じただけのときもある */
    }
  }, [data]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <p className="text-sm text-ink/60">はじまり</p>
      <h1 className="mt-3 font-serif text-2xl tracking-tight text-ink">招待コード</h1>
      <p className="mt-8 max-w-prose text-ink/80">
        このコードは、あなたのペアへ入るための入口です。24 時間ほどで失いやすくなります。
      </p>

      {!apiUserReady ? (
        <p className="mt-10 max-w-prose text-sm text-ink/60">
          開発では、上のバーで利用者を選ぶと、コードが読み込まれます。
        </p>
      ) : null}

      {loading ? <p className="mt-10 text-sm text-ink/70">読み込み中です</p> : null}

      {error !== null && !loading ? (
        <p className="mt-10 text-sm text-indigo" role="alert">
          {error}
        </p>
      ) : null}

      {data !== null && !loading ? (
        <div className="mt-10 space-y-6">
          <div className="rounded-lg border border-ink/10 bg-white px-5 py-5">
            <p className="text-xs text-ink/60">コード</p>
            <p className="mt-2 font-mono text-xl tracking-wide text-ink">{data.code}</p>
            <p className="mt-4 text-xs text-ink/60">有効期限の目安</p>
            <p className="mt-1 text-sm text-ink/80">{formatExpiresAt(data.expiresAt)}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void onCopy()}
              className="inline-flex items-center justify-center rounded-lg border border-ink/15 bg-paper px-5 py-3 text-sm text-ink transition-opacity duration-500 hover:opacity-90"
            >
              コピー
            </button>
            {typeof navigator !== "undefined" && typeof navigator.share === "function" ? (
              <button
                type="button"
                onClick={() => void onShare()}
                className="inline-flex items-center justify-center rounded-lg border border-ink/15 bg-paper px-5 py-3 text-sm text-ink transition-opacity duration-500 hover:opacity-90"
              >
                共有
              </button>
            ) : null}
          </div>

          {copyState === "done" ? <p className="text-sm text-ink/70">コピー済みです</p> : null}
          {copyState === "failed" ? (
            <p className="text-sm text-indigo">クリップボードへ届きませんでした</p>
          ) : null}
        </div>
      ) : null}

      {pairId !== undefined &&
      pairId !== "" &&
      me !== null &&
      me.pair !== null &&
      me.pair.id === pairId &&
      me.pair.yourRole === "owner" &&
      me.pair.membershipState === "active" ? (
        <p className="mt-10">
          <Link
            to={`/onboarding/pairs/${pairId}/owner-approve`}
            className="text-sm text-indigo underline decoration-indigo/30 underline-offset-4 transition-opacity duration-500 hover:opacity-80"
          >
            入り待ちの確認
          </Link>
        </p>
      ) : null}

      <p className="mt-14">
        <Link
          to="/"
          className="text-sm text-indigo underline decoration-indigo/30 underline-offset-4 transition-opacity duration-500 hover:opacity-80"
        >
          凪の入口へ
        </Link>
      </p>
    </main>
  );
}
