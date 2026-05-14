import type { ApiErrorBody } from "../api/types.js";

const USER_HEADER = "X-Nagi-User-Id";

export type ApiClientOptions = {
  getUserId: () => string | null;
};

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (text === "") {
    throw new Error("空のレスポンスです");
  }
  return JSON.parse(text) as T;
}

/**
 * `/api` は Vite のプロキシ経由でバックエンドへ届く。
 * 認証の切替責務はフロントに持たず、ヘッダーで Phase 1 の利用者だけ伝える。
 */
export function createApiClient(options: ApiClientOptions) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    const uid = options.getUserId();
    if (uid !== null && uid !== "") {
      headers.set(USER_HEADER, uid);
    }
    const res = await fetch(path, { ...init, headers });
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
    const uid = options.getUserId();
    if (uid !== null && uid !== "") {
      headers.set(USER_HEADER, uid);
    }
    const res = await fetch(path, {
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
    const uid = options.getUserId();
    if (uid !== null && uid !== "") {
      headers.set(USER_HEADER, uid);
    }
    const res = await fetch(path, {
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
