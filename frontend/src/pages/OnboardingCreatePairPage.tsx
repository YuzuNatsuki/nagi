import type { FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { CreatePairRequestBody, CreatePairResponseBody, MeResponse, RelationshipTagId } from "../api/types.js";
import { RELATIONSHIP_TAG_OPTIONS } from "../domain/relationship-tags.js";
import { useDevUser } from "../context/DevUserContext.js";

export function OnboardingCreatePairPage(): ReactElement {
  const { userId, api, apiUserReady, firebaseUid } = useDevUser();
  const navigate = useNavigate();
  const [pairDisplayName, setPairDisplayName] = useState("");
  const [relationshipTag, setRelationshipTag] = useState<RelationshipTagId>("family");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
          navigate(`/onboarding/pairs/${me.pair.id}/invite`, { replace: true });
        }
      } catch {
        /* 401 などはこの画面のまま */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, navigate, userId, firebaseUid]);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);
    if (!apiUserReady) {
      setFormError("利用者がまだ選ばれていません");
      return;
    }
    setSubmitting(true);
    try {
      const body: CreatePairRequestBody = {
        pairDisplayName,
        relationshipTag,
      };
      const created = await api.postJson<CreatePairResponseBody>("/api/pairs", body);
      navigate(`/onboarding/pairs/${created.pair.id}/invite`, { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <p className="text-sm text-ink/60">はじまり</p>
      <h1 className="mt-3 font-serif text-2xl tracking-tight text-ink">ペアをつくる</h1>
      <p className="mt-8 max-w-prose text-ink/80">
        ペアの呼び名と、関係性のタグだけです。あとから変えられる前提で、いまわかる範囲で選べます。
      </p>

      <form className="mt-12 space-y-10" onSubmit={(e) => void onSubmit(e)}>
        <div>
          <label className="block text-sm text-ink/80" htmlFor="pair-display-name">
            ペアの表示名
          </label>
          <input
            id="pair-display-name"
            name="pairDisplayName"
            type="text"
            maxLength={40}
            autoComplete="off"
            className="mt-3 w-full rounded-lg border border-ink/15 bg-white px-4 py-3 text-ink outline-none ring-indigo/30 focus:ring-2"
            value={pairDisplayName}
            onChange={(ev) => {
              setPairDisplayName(ev.target.value);
            }}
            placeholder="例: わが家"
          />
          <p className="mt-2 text-xs text-ink/55">全角換算で 40 字まで</p>
        </div>

        <fieldset className="space-y-4">
          <legend className="text-sm text-ink/80">関係性のタグ</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {RELATIONSHIP_TAG_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={`flex cursor-pointer flex-col rounded-lg border px-4 py-4 transition-opacity duration-500 ${
                  relationshipTag === opt.id
                    ? "border-indigo/40 bg-white shadow-sm ring-1 ring-indigo/25"
                    : "border-ink/10 bg-white/70 hover:opacity-90"
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="relationshipTag"
                    value={opt.id}
                    checked={relationshipTag === opt.id}
                    onChange={() => {
                      setRelationshipTag(opt.id);
                    }}
                    className="accent-indigo"
                  />
                  <span className="font-serif text-base text-ink">{opt.label}</span>
                </span>
                <span className="mt-2 pl-7 text-xs text-ink/60">{opt.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {formError !== null ? (
          <p className="text-sm text-indigo" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={submitting || pairDisplayName.trim() === ""}
            className="inline-flex items-center justify-center rounded-lg bg-ink px-6 py-3 text-sm text-paper transition-opacity duration-500 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "送っています" : "ペアをつくる"}
          </button>
          <Link
            to="/onboarding"
            className="text-sm text-indigo underline decoration-indigo/30 underline-offset-4 transition-opacity duration-500 hover:opacity-80"
          >
            はじまりに戻る
          </Link>
        </div>
      </form>
    </main>
  );
}
