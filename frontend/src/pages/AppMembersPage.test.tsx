import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppTestProviders } from "../test/test-providers.js";
import { AppMembersPage } from "./AppMembersPage.js";

describe("AppMembersPage", () => {
  it("見出しを表示する", () => {
    render(
      <MemoryRouter initialEntries={["/app/members"]}>
        <AppTestProviders>
          <Routes>
            <Route path="/app/members" element={<AppMembersPage />} />
          </Routes>
        </AppTestProviders>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "メンバーとプライバシー" })).toBeInTheDocument();
  });
});
