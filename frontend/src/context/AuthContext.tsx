import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { getFirebaseWebAuth, isFirebaseClientConfigured } from "../lib/firebase-client.js";

type AuthContextValue = {
  firebaseEnabled: boolean;
  authReady: boolean;
  user: User | null;
  getFirebaseIdToken: () => Promise<string | null>;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  signUpWithEmailPassword: (email: string, password: string) => Promise<void>;
  signOutFirebase: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const firebaseEnabled = isFirebaseClientConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!firebaseEnabled);

  useEffect(() => {
    if (!firebaseEnabled) {
      return;
    }
    const auth = getFirebaseWebAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, [firebaseEnabled]);

  const getFirebaseIdToken = useCallback(async () => {
    if (user === null) {
      return null;
    }
    return user.getIdToken();
  }, [user]);

  const signInWithEmailPassword = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseWebAuth();
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUpWithEmailPassword = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseWebAuth();
    await createUserWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signOutFirebase = useCallback(async () => {
    if (!firebaseEnabled) {
      return;
    }
    await signOut(getFirebaseWebAuth());
  }, [firebaseEnabled]);

  const value = useMemo(
    () => ({
      firebaseEnabled,
      authReady,
      user,
      getFirebaseIdToken,
      signInWithEmailPassword,
      signUpWithEmailPassword,
      signOutFirebase,
    }),
    [
      firebaseEnabled,
      authReady,
      user,
      getFirebaseIdToken,
      signInWithEmailPassword,
      signUpWithEmailPassword,
      signOutFirebase,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error("AuthProvider の内側で使ってください");
  }
  return ctx;
}
