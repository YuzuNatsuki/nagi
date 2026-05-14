import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DevUserProvider } from "../context/DevUserContext.js";
import { OnboardingOwnerApprovePage } from "./OnboardingOwnerApprovePage.js";

describe("OnboardingOwnerApprovePage", () => {
  it("承認の見出しを表示する", () => {
    render(
      <MemoryRouter initialEntries={["/onboarding/pairs/pair_test/owner-approve"]}>
        <DevUserProvider>
          <Routes>
            <Route path="/onboarding/pairs/:pairId/owner-approve" element={<OnboardingOwnerApprovePage />} />
          </Routes>
        </DevUserProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "承認" })).toBeInTheDocument();
  });
});
