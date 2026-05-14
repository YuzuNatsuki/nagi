/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloud Run 等の API オリジン（`https://....run.app`）。未設定で相対 `/api`。 */
  readonly VITE_PUBLIC_API_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
