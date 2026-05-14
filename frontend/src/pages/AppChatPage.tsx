import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  ChatMessage,
  ChatMessagesResponseBody,
  MeResponse,
  PairMembersResponseBody,
} from "../api/types.js";
import { routeAfterMe } from "../lib/me-navigation.js";
import { useDevUser } from "../context/DevUserContext.js";

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return new Intl.DateTimeFormat("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

export function AppChatPage(): ReactElement {
  const { userId, api } = useDevUser();
  const navigate = useNavigate();
  const [members, setMembers] = useState<PairMembersResponseBody["members"]>([]);
  const [topicUserId, setTopicUserId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const reloadMessages = useCallback(async () => {
    if (userId === null) {
      setMessages([]);
      setMembers([]);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const me = await api.request<MeResponse>("/api/me");
      if (me.pair === null) {
        setMessages([]);
        setMembers([]);
        navigate("/onboarding", { replace: true });
        return;
      }
      const pairId = me.pair.id;
      const [msgRes, memRes] = await Promise.all([
        api.request<ChatMessagesResponseBody>(`/api/pairs/${pairId}/chat/messages`),
        api.request<PairMembersResponseBody>(`/api/pairs/${pairId}/members`),
      ]);
      setMessages(msgRes.messages);
      setMembers(memRes.members.filter((m) => m.membershipState === "active"));
    } catch (e) {
      setMessages([]);
      setMembers([]);
      setLoadError(e instanceof Error ? e.message : "読み取れませんでした");
    } finally {
      setLoading(false);
    }
  }, [api, navigate, userId]);

  useEffect(() => {
    void reloadMessages();
  }, [reloadMessages]);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function onSend(): Promise<void> {
    if (userId === null) {
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const me = await api.request<MeResponse>("/api/me");
      if (me.pair === null) {
        navigate("/onboarding", { replace: true });
        return;
      }
      const res = await api.postJson<ChatMessagesResponseBody>(`/api/pairs/${me.pair.id}/chat/messages`, {
        text: draft,
        topicUserId: topicUserId === "" ? null : topicUserId,
      });
      setDraft("");
      setMessages(res.messages);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "送れませんでした");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 transition-opacity duration-500">
      <p className="text-sm text-ink/60">凪</p>
      <h1 className="mt-3 font-serif text-2xl tracking-tight text-ink">凪に話す</h1>
      <p className="mt-8 max-w-prose text-ink/80">
        通知のかわりにはなりません。落ち着いたときに、短く話しかけるための場所です。
      </p>

      {userId === null ? (
        <p className="mt-10 max-w-prose text-sm text-ink/60">
          開発では、上のバーで利用者を選ぶと、会話が読み込まれます。
        </p>
      ) : null}

      {!loading && userId !== null && loadError === null ? (
        <div className="mt-8">
          <label htmlFor="chat-topic" className="block text-xs text-ink/60">
            話題にする人
          </label>
          <select
            id="chat-topic"
            value={topicUserId}
            onChange={(e) => {
              setTopicUserId(e.target.value);
            }}
            className="mt-2 w-full max-w-md rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-indigo/40 focus:outline-none focus:ring-1 focus:ring-indigo/25"
          >
            <option value="">特に指定なし</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {loading ? <p className="mt-10 text-sm text-ink/70">読み込み中です</p> : null}

      {loadError !== null ? (
        <p className="mt-10 text-sm text-indigo" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && userId !== null && loadError === null ? (
        <div className="mt-8 flex max-h-[28rem] flex-col rounded-lg border border-ink/10 bg-paper/80">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {messages.length === 0 ? (
              <p className="text-sm text-ink/65">まだ、会話はありません。一行からで大丈夫です。</p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.role === "user"
                      ? "ml-8 rounded-lg border border-ink/10 bg-white px-4 py-3"
                      : "mr-8 rounded-lg border border-indigo/15 bg-white px-4 py-3"
                  }
                >
                  <p className="text-xs text-ink/50">{m.role === "user" ? "あなた" : "凪"}・{formatTime(m.createdAt)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink/90">{m.body}</p>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-ink/10 bg-white px-4 py-4">
            <label htmlFor="chat-input" className="sr-only">
              メッセージ
            </label>
            <textarea
              id="chat-input"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
              }}
              rows={3}
              className="w-full resize-none rounded-lg border border-ink/15 bg-paper px-3 py-3 text-sm text-ink placeholder:text-ink/35 focus:border-indigo/40 focus:outline-none focus:ring-1 focus:ring-indigo/25"
              placeholder="ことばにしなくても、途中まででも構いません。"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={sending || draft.trim() === ""}
                onClick={() => void onSend()}
                className="inline-flex items-center justify-center rounded-lg bg-ink px-5 py-2.5 text-sm text-paper transition-opacity duration-500 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? "送っています" : "送る"}
              </button>
            </div>
            {sendError !== null ? (
              <p className="mt-3 text-sm text-indigo" role="alert">
                {sendError}
              </p>
            ) : null}
          </div>
        </div>
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
