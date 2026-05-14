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
};

const DevUserContext = createContext<DevUserContextValue | null>(null);

export function DevUserProvider({ children }: { children: ReactNode }): ReactElement {
  const [userId, setUserId] = useState<string | null>(null);
  const { getFirebaseIdToken, firebaseEnabled } = useAuth();

  const getUserId = useCallback(() => userId, [userId]);

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
    }),
    [userId, api],
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
