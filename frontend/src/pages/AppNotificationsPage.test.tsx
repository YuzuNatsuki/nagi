import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DevUserProvider } from "../context/DevUserContext.js";
import { AppNotificationsPage } from "./AppNotificationsPage.js";

describe("AppNotificationsPage", () => {
  it("見出しを表示する", () => {
    render(
      <MemoryRouter initialEntries={["/app/notifications"]}>
        <DevUserProvider>
          <Routes>
            <Route path="/app/notifications" element={<AppNotificationsPage />} />
          </Routes>
        </DevUserProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "通知履歴" })).toBeInTheDocument();
  });
});
