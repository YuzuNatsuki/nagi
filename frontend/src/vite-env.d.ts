/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloud Run 等の API オリジン（`https://....run.app`）。未設定で相対 `/api`。 */
  readonly VITE_PUBLIC_API_ORIGIN?: string;
  /** Firebase Web（Authentication）。いずれか欠けるとメール認証 UI は無効。 */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
