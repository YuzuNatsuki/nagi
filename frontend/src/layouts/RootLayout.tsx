import type { ReactElement } from "react";
import { useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { DevUserBar } from "../components/DevUserBar.js";
import { useDevUser } from "../context/DevUserContext.js";

function UserChangeRedirect(): null {
  const { userId } = useDevUser();
  const navigate = useNavigate();
  const prevUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (prevUserId.current === undefined) {
      prevUserId.current = userId;
      return;
    }
    if (prevUserId.current !== userId) {
      prevUserId.current = userId;
      navigate("/", { replace: true });
    }
  }, [userId, navigate]);

  return null;
}

export function RootLayout(): ReactElement {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <DevUserBar />
      <UserChangeRedirect />
      <Outlet />
    </div>
  );
}
