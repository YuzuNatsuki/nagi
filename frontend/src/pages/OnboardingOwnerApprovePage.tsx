import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  ApproveMemberResponseBody,
  MeResponse,
  PendingMembersResponseBody,
} from "../api/types.js";
import { useDevUser } from "../context/DevUserContext.js";

export function OnboardingOwnerApprovePage(): ReactElement {
  const { pairId } = useParams();
  const { api, apiUserReady, firebaseUid } = useDevUser();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [members, setMembers] = useState<PendingMembersResponseBody["members"]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (pairId === undefined || pairId === "" || !apiUserReady) {
      return;
    }
    setLoading(true);
    setListError(null);
    try {
      const meNow = await api.request<MeResponse>("/api/me");
      setMe(meNow);
      if (meNow.pair === null || meNow.pair.id !== pairId || meNow.pair.yourRole !== "owner") {
        setMembers([]);
        setListError("この画面には入れません");
        return;
      }
      const res = await api.request<PendingMembersResponseBody>(`/api/pairs/${pairId}/pending-members`);
      setMembers(res.members);
    } catch (e) {
      setMembers([]);
      setListError(e instanceof Error ? e.message : "読み取れませんでした");
    } finally {
      setLoading(false);
    }
  }, [api, pairId, apiUserReady, firebaseUid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onApprove(memberUserId: string): Promise<void> {
    if (pairId === undefined || pairId === "") {
      return;
    }
    setActionError(null);
    setBusyUserId(memberUserId);
    try {
      await api.postJson<ApproveMemberResponseBody>(
        `/api/pairs/${pairId}/members/${memberUserId}/approve`,
        {},
      );
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <p className="text-sm text-ink/60">はじまり</p>
      <h1 className="mt-3 font-serif text-2xl tracking-tight text-ink">承認</h1>
      <p className="mt-8 max-w-prose text-ink/80">
        招待で入ってきた人だけが並びます。迷ったら、あとからでも大丈夫です。
      </p>

      {!apiUserReady ? (
        <p className="mt-10 max-w-prose text-sm text-ink/60">
          開発では、上のバーで利用者を選ぶと、一覧が読み込まれます。
        </p>
      ) : null}

      {loading ? <p className="mt-10 text-sm text-ink/70">読み込み中です</p> : null}

      {listError !== null && !loading ? (
        <p className="mt-10 text-sm text-indigo" role="alert">
          {listError}
        </p>
      ) : null}

      {actionError !== null ? (
        <p className="mt-8 text-sm text-indigo" role="alert">
          {actionError}
        </p>
      ) : null}

      {me !== null && me.pair !== null && me.pair.id === pairId ? (
        <p className="mt-10 text-sm text-ink/60">ペア名: {me.pair.displayName}</p>
      ) : null}

      {members.length === 0 && !loading && listError === null && apiUserReady ? (
        <p className="mt-10 max-w-prose text-sm text-ink/70">いま、入り待ちはありません。</p>
      ) : null}

      {members.length > 0 ? (
        <ul className="mt-10 space-y-4">
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex flex-col gap-4 rounded-lg border border-ink/10 bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-serif text-lg text-ink">{m.displayName}</p>
                <p className="mt-1 text-xs text-ink/55">利用者ID: {m.userId}</p>
              </div>
              <button
                type="button"
                disabled={busyUserId !== null}
                onClick={() => void onApprove(m.userId)}
                className="inline-flex items-center justify-center rounded-lg bg-ink px-5 py-3 text-sm text-paper transition-opacity duration-500 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busyUserId === m.userId ? "送っています" : "ペアに加える"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-14 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        {pairId !== undefined && pairId !== "" ? (
          <Link
            to={`/onboarding/pairs/${pairId}/invite`}
            className="text-sm text-indigo underline decoration-indigo/30 underline-offset-4 transition-opacity duration-500 hover:opacity-80"
          >
            招待コードへ戻る
          </Link>
        ) : null}
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
