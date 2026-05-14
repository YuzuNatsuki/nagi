import { render, screen, waitFor } from "@testing-library/react";
import { useLayoutEffect, type ReactElement, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppTestProviders } from "../test/test-providers.js";
import { useDevUser } from "../context/DevUserContext.js";
import { AppNotificationsPage } from "./AppNotificationsPage.js";

function DevUserFixture({ userId, children }: { userId: string; children: ReactNode }): ReactElement {
  const { setUserId } = useDevUser();
  useLayoutEffect(() => {
    setUserId(userId);
  }, [setUserId, userId]);
  return <>{children}</>;
}

describe("AppNotificationsPage", () => {
  it("見出しを表示する", () => {
    render(
      <MemoryRouter initialEntries={["/app/notifications"]}>
        <AppTestProviders>
          <Routes>
            <Route path="/app/notifications" element={<AppNotificationsPage />} />
          </Routes>
        </AppTestProviders>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "通知履歴" })).toBeInTheDocument();
  });

  it("利用者選択時はブラウザ通知の試行ボタンを出す", async () => {
    render(
      <MemoryRouter initialEntries={["/app/notifications"]}>
        <AppTestProviders>
          <DevUserFixture userId="user-owner-01">
            <Routes>
              <Route path="/app/notifications" element={<AppNotificationsPage />} />
            </Routes>
          </DevUserFixture>
        </AppTestProviders>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "ブラウザ通知を試す" })).toBeInTheDocument();
    });
  });
});
