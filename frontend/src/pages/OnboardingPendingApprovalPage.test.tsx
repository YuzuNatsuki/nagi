import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppTestProviders } from "../test/test-providers.js";
import { OnboardingPendingApprovalPage } from "./OnboardingPendingApprovalPage.js";

describe("OnboardingPendingApprovalPage", () => {
  it("見出しを表示する", () => {
    render(
      <MemoryRouter initialEntries={["/onboarding/pending-approval"]}>
        <AppTestProviders>
          <Routes>
            <Route path="/onboarding/pending-approval" element={<OnboardingPendingApprovalPage />} />
          </Routes>
        </AppTestProviders>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "承認待ち" })).toBeInTheDocument();
  });
});
