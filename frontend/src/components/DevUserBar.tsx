import { useEffect, useState } from "react";
import type { DummyUserOption, MeResponse } from "../api/types.js";
import { useDevUser } from "../context/DevUserContext.js";

export function DevUserBar(): React.ReactElement {
  const { userId, setUserId, api } = useDevUser();
  const [options, setOptions] = useState<DummyUserOption[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    if (userId === null) {
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
  }, [api, userId]);

  return (
    <aside
      className="border-b border-ink/10 bg-paper px-6 py-4 transition-opacity duration-fade"
      aria-label="開発用の利用者切替"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-serif text-sm text-ink/80">Phase 1: 固定ダミー利用者</p>
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
