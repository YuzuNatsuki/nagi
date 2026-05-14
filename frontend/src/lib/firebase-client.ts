import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

let cachedAuth: Auth | null = null;

function readFirebaseWebConfig(): FirebaseOptions | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim();
  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }
  return { apiKey, authDomain, projectId, appId };
}

export function isFirebaseClientConfigured(): boolean {
  return readFirebaseWebConfig() !== null;
}

/**
 * Web SDK の Auth。`isFirebaseClientConfigured()` が false のときは呼ばないこと。
 */
export function getFirebaseWebAuth(): Auth {
  if (cachedAuth !== null) {
    return cachedAuth;
  }
  const opts = readFirebaseWebConfig();
  if (opts === null) {
    throw new Error("Firebase Web の環境変数が足りません");
  }
  const app = getApps().length === 0 ? initializeApp(opts) : getApps()[0]!;
  cachedAuth = getAuth(app);
  return cachedAuth;
}
