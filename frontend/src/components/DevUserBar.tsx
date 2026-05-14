import { useEffect, useState } from "react";
import type { DummyUserOption, MeResponse } from "../api/types.js";
import { useAuth } from "../context/AuthContext.js";
import { useDevUser } from "../context/DevUserContext.js";
import { Link } from "react-router-dom";

export function DevUserBar(): React.ReactElement {
  const { userId, setUserId, api } = useDevUser();
  const { firebaseEnabled, authReady, user: fbUser, signOutFirebase } = useAuth();
  const [options, setOptions] = useState<DummyUserOption[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const showDummyControls = !firebaseEnabled || fbUser === null;

  useEffect(() => {
    if (!showDummyControls) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.request<{ users: DummyUserOption[] }>("/api/dev/dummy-users");
        if (!cancelled) {
          setOptions(data.users);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "一覧の取得に失敗しました");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, showDummyControls]);

  useEffect(() => {
    let cancelled = false;
    if (!showDummyControls || userId === null) {
      setMe(null);
      return;
    }
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await api.request<MeResponse>("/api/me");
        if (!cancelled) {
          setMe(data);
        }
      } catch (e) {
        if (!cancelled) {
          setMe(null);
          setError(e instanceof Error ? e.message : "確認に失敗しました");
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
  }, [api, userId, showDummyControls]);

  if (firebaseEnabled && !authReady) {
    return (
      <aside
        className="border-b border-ink/10 bg-paper px-6 py-4 transition-opacity duration-fade"
        aria-label="認証の準備"
      >
        <p className="mx-auto max-w-3xl text-sm text-ink/70">認証の準備をしています</p>
      </aside>
    );
  }

  if (firebaseEnabled && fbUser !== null) {
    return (
      <aside
        className="border-b border-ink/10 bg-paper px-6 py-4 transition-opacity duration-fade"
        aria-label="ログイン状態"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-serif text-sm text-ink/80">
            ログイン中: {fbUser.email ?? fbUser.displayName ?? fbUser.uid}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none ring-indigo/30 focus:ring-2"
              onClick={() => void signOutFirebase()}
            >
              ログアウト
            </button>
            <Link
              to="/"
              className="text-sm text-indigo underline decoration-indigo/30 underline-offset-4 transition-opacity duration-500 hover:opacity-80"
            >
              ホームへ
            </Link>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="border-b border-ink/10 bg-paper px-6 py-4 transition-opacity duration-fade"
      aria-label="開発用の利用者切替"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-serif text-sm text-ink/80">
            {firebaseEnabled ? "Firebase または Phase 1 の固定ダミー利用者" : "Phase 1: 固定ダミー利用者"}
          </p>
          {firebaseEnabled ? (
            <p className="mt-2 text-sm text-ink/70">
              <Link to="/sign-in" className="text-indigo underline underline-offset-4">
                メールでログイン
              </Link>
              <span className="text-ink/40"> · </span>
              <Link to="/sign-up" className="text-indigo underline underline-offset-4">
                新規登録
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-ink/80" htmlFor="dev-user-select">
            表示名
          </label>
          <select
            id="dev-user-select"
            className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none ring-indigo/30 focus:ring-2"
            value={userId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setUserId(v === "" ? null : v);
            }}
          >
            <option value="">未選択</option>
            {options.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
          <span className="text-sm text-ink/70" aria-live="polite">
            {loading ? "つながっています" : me ? `${me.user.displayName} として接続中` : null}
          </span>
        </div>
      </div>
      {error !== null ? (
        <p className="mx-auto mt-2 max-w-3xl text-sm text-indigo" role="status">
          {error}
        </p>
      ) : null}
    </aside>
  );
}
