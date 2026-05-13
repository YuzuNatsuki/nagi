import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createApiClient, type ApiClient } from "../lib/api-client.js";

type DevUserContextValue = {
  userId: string | null;
  setUserId: (id: string | null) => void;
  api: ApiClient;
};

const DevUserContext = createContext<DevUserContextValue | null>(null);

export function DevUserProvider({ children }: { children: ReactNode }): ReactElement {
  const [userId, setUserId] = useState<string | null>(null);

  const getUserId = useCallback(() => userId, [userId]);

  const api = useMemo(() => createApiClient({ getUserId }), [getUserId]);

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
