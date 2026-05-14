import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppTestProviders } from "../test/test-providers.js";
import { AppAnnouncementsPage } from "./AppAnnouncementsPage.js";

describe("AppAnnouncementsPage", () => {
  it("見出しを表示する", () => {
    render(
      <MemoryRouter initialEntries={["/app/announcements"]}>
        <AppTestProviders>
          <Routes>
            <Route path="/app/announcements" element={<AppAnnouncementsPage />} />
          </Routes>
        </AppTestProviders>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "お知らせ" })).toBeInTheDocument();
  });
});
