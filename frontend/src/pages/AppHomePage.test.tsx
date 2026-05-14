import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppTestProviders } from "../test/test-providers.js";
import { AppHomePage } from "./AppHomePage.js";

describe("AppHomePage", () => {
  it("見出しを表示する", () => {
    render(
      <MemoryRouter initialEntries={["/app"]}>
        <AppTestProviders>
          <Routes>
            <Route path="/app" element={<AppHomePage />} />
          </Routes>
        </AppTestProviders>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "凪" })).toBeInTheDocument();
  });
});
