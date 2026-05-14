import type { ApiErrorBody } from "../api/types.js";

const USER_HEADER = "X-Nagi-User-Id";

export type ApiClientOptions = {
  getUserId: () => string | null;
  /**
   * Firebase にログインしているとき、ID トークンを付与する。Bearer が優先される。
   */
  getFirebaseIdToken?: () => Promise<string | null>;
  /**
   * 本番デモ用: Cloud Run のオリジン（例 `https://nagi-api-xxxxx-xx.a.run.app`）。末尾スラッシュなし。
   * 未指定・空のときは相対パス（Vite プロキシ向け）。
   */
  apiOrigin?: string;
};

function resolveFetchUrl(path: string, apiOrigin: string | undefined): string {
  const origin = apiOrigin?.trim() ?? "";
  if (origin === "") {
    return path;
  }
  if (path.startsWith("/")) {
    return `${origin.replace(/\/$/, "")}${path}`;
  }
  return `${origin.replace(/\/$/, "")}/${path}`;
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (text === "") {
    throw new Error("空のレスポンスです");
  }
  return JSON.parse(text) as T;
}

async function applyAuthHeaders(
  headers: Headers,
  options: ApiClientOptions,
): Promise<void> {
  const token = (await options.getFirebaseIdToken?.()) ?? null;
  if (token !== null && token !== "") {
    headers.set("Authorization", `Bearer ${token}`);
    return;
  }
  const uid = options.getUserId();
  if (uid !== null && uid !== "") {
    headers.set(USER_HEADER, uid);
  }
}

/**
 * `/api` は開発時は Vite のプロキシ経由。`apiOrigin` を渡すと絶対 URL で Cloud Run 等へ届く。
 * Phase 2: Firebase ID トークンがあれば Bearer を付与し、なければ Phase 1 のヘッダーを使う。
 */
export function createApiClient(options: ApiClientOptions) {
  const { apiOrigin } = options;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    await applyAuthHeaders(headers, options);
    const url = resolveFetchUrl(path, apiOrigin);
    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
      let message = res.statusText;
      try {
        const body = (await res.json()) as ApiErrorBody;
        message = body.error.message;
      } catch {
        /* 無視 */
      }
      throw new Error(message);
    }
    return parseJson<T>(res);
  }

  async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
    const headers = new Headers({ "Content-Type": "application/json" });
    await applyAuthHeaders(headers, options);
    const url = resolveFetchUrl(path, apiOrigin);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let message = res.statusText;
      try {
        const errBody = (await res.json()) as ApiErrorBody;
        message = errBody.error.message;
      } catch {
        /* 無視 */
      }
      throw new Error(message);
    }
    return parseJson<TResponse>(res);
  }

  async function putJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
    const headers = new Headers({ "Content-Type": "application/json" });
    await applyAuthHeaders(headers, options);
    const url = resolveFetchUrl(path, apiOrigin);
    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let message = res.statusText;
      try {
        const errBody = (await res.json()) as ApiErrorBody;
        message = errBody.error.message;
      } catch {
        /* 無視 */
      }
      throw new Error(message);
    }
    return parseJson<TResponse>(res);
  }

  return { request, postJson, putJson };
}

export type ApiClient = ReturnType<typeof createApiClient>;
