import type { ReactElement } from "react";
import { BrowserRouter } from "react-router-dom";
import { DevUserProvider } from "./context/DevUserContext.js";
import { AppRoutes } from "./routes/AppRoutes.js";

export function App(): ReactElement {
  return (
    <BrowserRouter>
      <DevUserProvider>
        <AppRoutes />
      </DevUserProvider>
    </BrowserRouter>
  );
}
