import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DevUserProvider } from "../context/DevUserContext.js";
import { OnboardingChoicePage } from "./OnboardingChoicePage.js";

describe("OnboardingChoicePage", () => {
  it("二つの入口を示す", () => {
    render(
      <MemoryRouter>
        <DevUserProvider>
          <OnboardingChoicePage />
        </DevUserProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "ペアがまだありません" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ペアをつくる/ })).toHaveAttribute("href", "/onboarding/create-pair");
    expect(screen.getByRole("link", { name: /招待コードを入れる/ })).toHaveAttribute(
      "href",
      "/onboarding/enter-invite",
    );
  });
});
