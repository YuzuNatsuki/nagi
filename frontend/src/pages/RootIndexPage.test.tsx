import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppTestProviders } from "../test/test-providers.js";
import { RootIndexPage } from "./RootIndexPage.js";

describe("RootIndexPage", () => {
  it("見出しを表示する", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppTestProviders>
          <Routes>
            <Route index element={<RootIndexPage />} />
          </Routes>
        </AppTestProviders>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "凪" })).toBeInTheDocument();
  });
});
