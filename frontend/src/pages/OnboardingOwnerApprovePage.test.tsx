import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppTestProviders } from "../test/test-providers.js";
import { OnboardingOwnerApprovePage } from "./OnboardingOwnerApprovePage.js";

describe("OnboardingOwnerApprovePage", () => {
  it("承認の見出しを表示する", () => {
    render(
      <MemoryRouter initialEntries={["/onboarding/pairs/pair_test/owner-approve"]}>
        <AppTestProviders>
          <Routes>
            <Route path="/onboarding/pairs/:pairId/owner-approve" element={<OnboardingOwnerApprovePage />} />
          </Routes>
        </AppTestProviders>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "承認" })).toBeInTheDocument();
  });
});
