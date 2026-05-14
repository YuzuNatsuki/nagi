import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppTestProviders } from "../test/test-providers.js";
import { AppWhisperPage } from "./AppWhisperPage.js";

describe("AppWhisperPage", () => {
  it("見出しを表示する", () => {
    render(
      <MemoryRouter initialEntries={["/app/whisper"]}>
        <AppTestProviders>
          <Routes>
            <Route path="/app/whisper" element={<AppWhisperPage />} />
          </Routes>
        </AppTestProviders>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "ひとりごとメモ" })).toBeInTheDocument();
  });
});
