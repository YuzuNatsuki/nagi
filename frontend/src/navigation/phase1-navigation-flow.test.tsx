import { render, screen, waitFor } from "@testing-library/react";
import { useEffect, type ReactElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useDevUser } from "../context/DevUserContext.js";
import { AppRoutes } from "../routes/AppRoutes.js";
import { setStubMePairActiveForTests } from "../test/setup.js";
import { AppTestProviders } from "../test/test-providers.js";

function DevUserFixture({ userId, children }: { userId: string; children: ReactNode }): ReactElement {
  const { setUserId } = useDevUser();
  useEffect(() => {
    setUserId(userId);
    return () => {
      setUserId(null);
    };
  }, [setUserId, userId]);
  return <>{children}</>;
}

describe("Phase 1 画面遷移（スタブ API）", () => {
  it("ルートからペアが無いときはじまりへ移る", async () => {
    setStubMePairActiveForTests(false);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppTestProviders>
          <DevUserFixture userId="user-owner-01">
            <AppRoutes />
          </DevUserFixture>
        </AppTestProviders>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "ペアがまだありません" })).toBeInTheDocument();
    });
  });

  it("ルートからアクティブなペアがあるとき凪の入口へ移る", async () => {
    setStubMePairActiveForTests(true);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppTestProviders>
          <DevUserFixture userId="user-owner-01">
            <AppRoutes />
          </DevUserFixture>
        </AppTestProviders>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/としてつながっています/)).toBeInTheDocument();
    });
  });
});
