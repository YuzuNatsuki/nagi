import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { MeResponse, PendingMembersResponseBody } from "../api/types.js";
import { routeAfterMe } from "../lib/me-navigation.js";
import { useDevUser } from "../context/DevUserContext.js";

type HomeTile = {
  to: string;
  title: string;
  description: string;
};

const tilesNow: HomeTile[] = [
  {
    to: "/app/mood",
    title: "今日のメモ",
    description: "いまの気持ちや体調を、日ごとにことばにしておけます。",
  },
  {
    to: "/app/whisper",
    title: "ひとりごとメモ",
    description: "声にならないほうのメモを、日ごとに置けます。",
  },
  {
    to: "/app/chat",
    title: "凪に話す",
    description: "落ち着いたときに、短く話しかけるための場所です。",
  },
];

const tilesLookBack: HomeTile[] = [
  {
    to: "/app/notifications",
    title: "通知履歴",
    description: "届いたメッセージのかたちを、あとから振り返れます。",
  },
  {
    to: "/app/announcements",
    title: "お知らせ",
    description: "運営からの便りです。ペアとは別に開けます。",
  },
];

const tilesPair: HomeTile[] = [
  {
    to: "/app/members",
    title: "メンバーとプライバシー",
    description: "人の一覧と、チャットの保持のしかたを整えます。",
  },
  {
    to: "/app/pairs",
    title: "ペアの切替",
    description: "いま開くペアを選びます。",
  },
  {
    to: "/app/settings",
    title: "設定",
    description: "呼び名と導線を、まとめて確認できます。",
  },
];

function TileGrid({
  title,
  sectionId,
  items,
}: {
  title: string;
  sectionId: string;
  items: HomeTile[];
}): ReactElement {
  return (
    <section className="mt-12" aria-labelledby={`home-section-${sectionId}`}>
      <h2 id={`home-section-${sectionId}`} className="text-sm font-medium tracking-wide text-ink/70">
        {title}
      </h2>
      <ul className="mt-4 grid list-none gap-4 sm:grid-cols-2">
        {items.map((t) => (
          <li key={t.to}>
            <Link
              to={t.to}
              className="group flex h-full flex-col rounded-xl border border-ink/10 bg-white p-5 shadow-sm transition duration-300 hover:border-indigo/30 hover:shadow-md"
            >
              <span className="font-medium text-ink">{t.title}</span>
              <span className="mt-2 flex-1 text-sm leading-relaxed text-ink/70">{t.description}</span>
              <span className="mt-4 text-sm text-indigo underline decoration-indigo/25 underline-offset-4 transition group-hover:decoration-indigo/50">
                開く
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AppHomePage(): ReactElement {
  const { userId, api } = useDevUser();
  const navigate = useNavigate();
  const [approvalPairId, setApprovalPairId] = useState<string | null>(null);
  const [homeMe, setHomeMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userId === null) {
      setApprovalPairId(null);
      setHomeMe(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const me = await api.request<MeResponse>("/api/me");
        if (cancelled) {
          return;
        }
        if (me.pair === null) {
          setHomeMe(null);
          navigate("/onboarding", { replace: true });
          return;
        }
        const next = routeAfterMe(me);
        if (next !== "/app") {
          setHomeMe(null);
          navigate(next, { replace: true });
          return;
        }

        setHomeMe(me);

        if (me.pair.yourRole === "owner" && me.pair.membershipState === "active") {
          try {
            const pending = await api.request<PendingMembersResponseBody>(
              `/api/pairs/${me.pair.id}/pending-members`,
            );
            if (cancelled) {
              return;
            }
            setApprovalPairId(pending.members.length > 0 ? me.pair.id : null);
          } catch {
            if (!cancelled) {
              setApprovalPairId(null);
            }
          }
        } else if (!cancelled) {
          setApprovalPairId(null);
        }
      } catch {
        if (!cancelled) {
          setHomeMe(null);
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
  }, [api, navigate, userId]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 transition-opacity duration-500 md:py-16">
      <header>
        <h1 className="font-serif text-3xl tracking-tight text-ink md:text-4xl">凪</h1>
        {userId === null ? (
          <p className="mt-6 max-w-prose text-ink/75">
            開発では、上のバーで利用者を選ぶと、ペアのようすが読み込まれます。
          </p>
        ) : null}
        {loading && userId !== null ? (
          <p className="mt-6 text-sm text-ink/60">読み込み中です</p>
        ) : null}
        {!loading && homeMe !== null && homeMe.pair !== null ? (
          <p className="mt-6 max-w-prose text-lg text-ink/85">
            <span className="font-medium text-ink">{homeMe.pair.displayName}</span>
            に、
            <span className="text-ink/90">{homeMe.user.displayName}</span>
            としてつながっています。
          </p>
        ) : null}
        {!loading && userId !== null && homeMe === null ? (
          <p className="mt-6 max-w-prose text-sm text-ink/65">ようすを読み取れませんでした。少し待ってから、もう一度試せます。</p>
        ) : null}
        <p className="mt-4 max-w-prose text-sm text-ink/60">
          左（または上）のメニューからも、いつでも画面を切り替えられます。
        </p>
      </header>

      {approvalPairId !== null ? (
        <div className="mt-10 rounded-xl border border-indigo/25 bg-indigo/5 px-5 py-4">
          <p className="text-sm font-medium text-ink">入り待ちの方がいます</p>
          <p className="mt-2 max-w-prose text-sm text-ink/75">
            承認すると、ペアの輪に迎え入れられます。
          </p>
          <p className="mt-4">
            <Link
              to={`/onboarding/pairs/${approvalPairId}/owner-approve`}
              className="inline-flex text-sm font-medium text-indigo underline decoration-indigo/35 underline-offset-4 transition hover:opacity-85"
            >
              承認画面へ進む
            </Link>
          </p>
        </div>
      ) : null}

      {userId !== null && homeMe !== null ? (
        <>
          <TileGrid title="いま、手を伸ばせるところ" sectionId="now" items={tilesNow} />
          <TileGrid title="振り返り" sectionId="look-back" items={tilesLookBack} />
          <TileGrid title="ペアとこの端末" sectionId="pair" items={tilesPair} />
        </>
      ) : null}
    </main>
  );
}
