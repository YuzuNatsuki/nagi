import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext.js";
import { createApiClient, type ApiClient } from "../lib/api-client.js";

type DevUserContextValue = {
  userId: string | null;
  setUserId: (id: string | null) => void;
  api: ApiClient;
  /**
   * Phase 1 のダミー利用者が選ばれているか、Phase 2 の Firebase にログイン済みなら true。
   * 各画面の `/api/me` 取得などはこれでガードする（Firebase 時は userId は null のまま）。
   */
  apiUserReady: boolean;
  /** Firebase ログイン時の UID。未ログインなら null。useEffect の依存に含める。 */
  firebaseUid: string | null;
};

const DevUserContext = createContext<DevUserContextValue | null>(null);

export function DevUserProvider({ children }: { children: ReactNode }): ReactElement {
  const [userId, setUserId] = useState<string | null>(null);
  const { getFirebaseIdToken, firebaseEnabled, user: fbUser } = useAuth();

  const getUserId = useCallback(() => userId, [userId]);

  const firebaseUid = fbUser?.uid ?? null;
  const apiUserReady = userId !== null || firebaseUid !== null;

  const api = useMemo(
    () =>
      createApiClient({
        getUserId,
        getFirebaseIdToken: firebaseEnabled ? getFirebaseIdToken : undefined,
        apiOrigin: import.meta.env.VITE_PUBLIC_API_ORIGIN?.trim() || undefined,
      }),
    [getUserId, getFirebaseIdToken, firebaseEnabled],
  );

  const value = useMemo(
    () => ({
      userId,
      setUserId,
      api,
      apiUserReady,
      firebaseUid,
    }),
    [userId, api, apiUserReady, firebaseUid],
  );

  return <DevUserContext.Provider value={value}>{children}</DevUserContext.Provider>;
}

export function useDevUser(): DevUserContextValue {
  const ctx = useContext(DevUserContext);
  if (ctx === null) {
    throw new Error("DevUserProvider の内側で使ってください");
  }
  return ctx;
}
