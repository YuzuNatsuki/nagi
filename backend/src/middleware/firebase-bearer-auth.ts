import type { NextFunction, Request, Response } from "express";
import type { NagiUser } from "../auth/nagi-user.js";

/** Firebase Hosting → Cloud Run 経由で `Authorization` が落ちる事例へのバックアップ（生の ID トークン）。 */
export const FIREBASE_ID_TOKEN_FALLBACK_HEADER = "x-nagi-firebase-id-token";

function jsonError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

function firebaseAuthErrorHint(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  const msg = err instanceof Error ? err.message : String(err);

  if (code === "auth/id-token-expired") {
    return "ログインの有効期限が切れました。もう一度ログインしてください。";
  }
  if (
    code === "auth/argument-error" ||
    code === "auth/invalid-argument" ||
    msg.toLowerCase().includes("aud") ||
    msg.includes("audience")
  ) {
    return "ID トークンとサーバの Firebase プロジェクトが一致していません。Cloud Run の環境変数 FIREBASE_PROJECT_ID を、フロントの VITE_FIREBASE_PROJECT_ID（Firebase コンソールのプロジェクト ID）と同じにしてください。";
  }
  return "資格情報の確認に失敗しました";
}

function displayNameFromDecoded(decoded: {
  name?: string;
  email?: string;
}): string {
  const name = decoded.name?.trim();
  if (name !== undefined && name !== "") {
    return name;
  }
  const email = decoded.email?.trim();
  if (email !== undefined && email.includes("@")) {
    const local = email.split("@")[0]?.trim();
    if (local !== undefined && local !== "") {
      return local;
    }
  }
  return "利用者";
}

function resolveFirebaseIdTokenFromRequest(req: Request): string {
  const rawAuth = req.header("authorization");
  const fromAuth =
    rawAuth !== undefined && rawAuth.toLowerCase().startsWith("bearer ")
      ? rawAuth.slice(7).trim()
      : "";
  if (fromAuth !== "") {
    return fromAuth;
  }
  return req.header(FIREBASE_ID_TOKEN_FALLBACK_HEADER)?.trim() ?? "";
}

/**
 * `Authorization: Bearer <Firebase ID token>` を検証し、`req.nagiUser` を設定する。
 * トークンが無いときは何もしない（ダミー認証や匿名へ委譲）。
 *
 * Hosting リライトで `Authorization` が届かない場合に備え、
 * `X-Nagi-Firebase-Id-Token` に同じ JWT を入れても検証できる。
 */
export function firebaseBearerAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const bearer = resolveFirebaseIdTokenFromRequest(req);

  if (bearer === "") {
    next();
    return;
  }

  const parts = bearer.split(".");
  if (parts.length !== 3) {
    jsonError(res, 401, "invalid_token", "資格情報を読み取れませんでした");
    return;
  }

  const projectId = (process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? "").trim();
  if (projectId === "") {
    jsonError(res, 503, "auth_unavailable", "サーバ側の Firebase プロジェクト ID がまだありません");
    return;
  }

  void (async () => {
    try {
      const admin = await import("firebase-admin");
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId,
        });
      }
      const decoded = await admin.auth().verifyIdToken(bearer);
      const nagiUser: NagiUser = {
        id: decoded.uid,
        displayName: displayNameFromDecoded(decoded),
      };
      req.nagiUser = nagiUser;
      next();
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        JSON.stringify({
          tag: "nagi.firebase.verifyIdToken",
          code,
          message: msg,
          projectId,
          hasAuthorization: Boolean(req.header("authorization")),
          hasFallbackTokenHeader: Boolean(req.header(FIREBASE_ID_TOKEN_FALLBACK_HEADER)),
        }),
      );
      jsonError(res, 401, "invalid_token", firebaseAuthErrorHint(err));
    }
  })();
}
