import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppTestProviders } from "../test/test-providers.js";
import { AppChatPage } from "./AppChatPage.js";

describe("AppChatPage", () => {
  it("見出しを表示する", () => {
    render(
      <MemoryRouter initialEntries={["/app/chat"]}>
        <AppTestProviders>
          <Routes>
            <Route path="/app/chat" element={<AppChatPage />} />
          </Routes>
        </AppTestProviders>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "凪に話す" })).toBeInTheDocument();
  });
});
