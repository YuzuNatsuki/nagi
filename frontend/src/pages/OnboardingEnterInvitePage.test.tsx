import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DevUserProvider } from "../context/DevUserContext.js";
import { OnboardingEnterInvitePage } from "./OnboardingEnterInvitePage.js";

describe("OnboardingEnterInvitePage", () => {
  it("コードが空のときは送信できない", () => {
    render(
      <MemoryRouter>
        <DevUserProvider>
          <OnboardingEnterInvitePage />
        </DevUserProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "招待コードを入れる" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "このコードで入る" })).toBeDisabled();
  });

  it("コードを入れると送信できる", () => {
    render(
      <MemoryRouter>
        <DevUserProvider>
          <OnboardingEnterInvitePage />
        </DevUserProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("招待コード"), { target: { value: "abcdABCD2345" } });
    expect(screen.getByRole("button", { name: "このコードで入る" })).not.toBeDisabled();
  });
});
