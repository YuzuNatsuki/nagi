import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DevUserProvider } from "./context/DevUserContext.js";
import { App } from "./App.js";
import "./index.css";

const rootEl = document.getElementById("root");
if (rootEl === null) {
  throw new Error("root が見つかりません");
}

createRoot(rootEl).render(
  <StrictMode>
    <DevUserProvider>
      <App />
    </DevUserProvider>
  </StrictMode>,
);
