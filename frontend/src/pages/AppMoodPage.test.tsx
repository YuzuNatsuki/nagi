import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DevUserProvider } from "../context/DevUserContext.js";
import { AppMoodPage } from "./AppMoodPage.js";

describe("AppMoodPage", () => {
  it("見出しを表示する", () => {
    render(
      <MemoryRouter initialEntries={["/app/mood"]}>
        <DevUserProvider>
          <Routes>
            <Route path="/app/mood" element={<AppMoodPage />} />
          </Routes>
        </DevUserProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "今日のメモ" })).toBeInTheDocument();
  });
});
