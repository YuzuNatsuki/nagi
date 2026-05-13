import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DevUserProvider } from "../context/DevUserContext.js";
import { OnboardingCreatePairPage } from "./OnboardingCreatePairPage.js";

describe("OnboardingCreatePairPage", () => {
  it("表示名が空のときは送信できない", () => {
    render(
      <MemoryRouter>
        <DevUserProvider>
          <OnboardingCreatePairPage />
        </DevUserProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "ペアをつくる" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ペアをつくる" })).toBeDisabled();
  });

  it("表示名を入れると送信できる", () => {
    render(
      <MemoryRouter>
        <DevUserProvider>
          <OnboardingCreatePairPage />
        </DevUserProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("ペアの表示名"), { target: { value: "わが家" } });
    expect(screen.getByRole("button", { name: "ペアをつくる" })).not.toBeDisabled();
  });
});
