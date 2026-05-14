import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DevUserProvider } from "../context/DevUserContext.js";
import { AppPairsPage } from "./AppPairsPage.js";

describe("AppPairsPage", () => {
  it("見出しを表示する", () => {
    render(
      <MemoryRouter initialEntries={["/app/pairs"]}>
        <DevUserProvider>
          <Routes>
            <Route path="/app/pairs" element={<AppPairsPage />} />
          </Routes>
        </DevUserProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "ペアの切替" })).toBeInTheDocument();
  });
});
