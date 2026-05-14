import type { ReactElement } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";

function mapAuthError(err: unknown): string {
  if (err !== null && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") {
    const code = (err as { code: string }).code;
    if (code === "auth/invalid-email") {
      return "メールアドレスの形が読み取れませんでした";
    }
    if (code === "auth/user-disabled") {
      return "このアカウントは、いま使えません";
    }
    if (
      code === "auth/user-not-found" ||
      code === "auth/wrong-password" ||
      code === "auth/invalid-credential"
    ) {
      return "メールアドレスまたはパスワードが一致しませんでした";
    }
  }
  return err instanceof Error ? err.message : "処理に失敗しました";
}

export function SignInPage(): ReactElement {
  const { firebaseEnabled, signInWithEmailPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!firebaseEnabled) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <p className="text-sm text-ink/70">
          Firebase の環境変数がまだありません。Vite の `VITE_FIREBASE_*` を設定すると起動できます。
        </p>
        <p className="mt-6">
          <Link to="/" className="text-sm text-indigo underline underline-offset-4">
            凪へ戻る
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <p className="text-sm text-ink/60">凪</p>
      <h1 className="mt-3 font-serif text-2xl tracking-tight text-ink">ログイン</h1>
      <p className="mt-6 max-w-prose text-sm text-ink/80">メールアドレスとパスワードで入ります。</p>

      <form
        className="mt-10 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          void (async () => {
            try {
              await signInWithEmailPassword(email, password);
              navigate("/", { replace: true });
            } catch (err) {
              setError(mapAuthError(err));
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <div>
          <label className="block text-sm text-ink/80" htmlFor="signin-email">
            メール
          </label>
          <input
            id="signin-email"
            type="email"
            autoComplete="email"
            className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none ring-indigo/30 focus:ring-2"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-ink/80" htmlFor="signin-password">
            パスワード
          </label>
          <input
            id="signin-password"
            type="password"
            autoComplete="current-password"
            className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none ring-indigo/30 focus:ring-2"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            required
          />
        </div>
        {error !== null ? (
          <p className="text-sm text-indigo" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-indigo px-4 py-2 text-sm text-white transition-opacity duration-500 hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "送っています" : "ログインする"}
        </button>
      </form>

      <p className="mt-8 text-sm text-ink/70">
        はじめての方は{" "}
        <Link to="/sign-up" className="text-indigo underline underline-offset-4">
          新規登録
        </Link>
      </p>
      <p className="mt-4">
        <Link to="/" className="text-sm text-indigo underline underline-offset-4">
          凪へ戻る
        </Link>
      </p>
    </main>
  );
}
