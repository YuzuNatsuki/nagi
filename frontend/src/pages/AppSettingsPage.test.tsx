import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DevUserProvider } from "../context/DevUserContext.js";
import { AppSettingsPage } from "./AppSettingsPage.js";

describe("AppSettingsPage", () => {
  it("見出しを表示する", () => {
    render(
      <MemoryRouter initialEntries={["/app/settings"]}>
        <DevUserProvider>
          <Routes>
            <Route path="/app/settings" element={<AppSettingsPage />} />
          </Routes>
        </DevUserProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "設定" })).toBeInTheDocument();
  });
});
