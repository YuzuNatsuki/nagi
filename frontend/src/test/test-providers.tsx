import type { ReactElement, ReactNode } from "react";
import { AuthProvider } from "../context/AuthContext.js";
import { DevUserProvider } from "../context/DevUserContext.js";

/** Vitest / RTL 用: 本番と同じく Auth → DevUser の順で包む */
export function AppTestProviders({ children }: { children: ReactNode }): ReactElement {
  return (
    <AuthProvider>
      <DevUserProvider>{children}</DevUserProvider>
    </AuthProvider>
  );
}
