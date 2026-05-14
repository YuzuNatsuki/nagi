import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppTestProviders } from "../test/test-providers.js";
import { OnboardingPairInvitePage } from "./OnboardingPairInvitePage.js";

describe("OnboardingPairInvitePage", () => {
  it("見出しを表示する", () => {
    render(
      <MemoryRouter initialEntries={["/onboarding/pairs/p1/invite"]}>
        <AppTestProviders>
          <Routes>
            <Route path="/onboarding/pairs/:pairId/invite" element={<OnboardingPairInvitePage />} />
          </Routes>
        </AppTestProviders>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "招待コード" })).toBeInTheDocument();
  });
});
