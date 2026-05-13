import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DevUserProvider } from "./context/DevUserContext.js";
import { AppRoutes } from "./routes/AppRoutes.js";

describe("AppRoutes", () => {
  it("ルートで凪の見出しを表示する", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <DevUserProvider>
          <AppRoutes />
        </DevUserProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "凪" })).toBeInTheDocument();
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });
});
