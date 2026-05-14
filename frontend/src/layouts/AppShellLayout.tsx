import type { ReactElement } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { APP_NAV_ITEMS } from "../lib/app-nav.js";

export function AppShellLayout(): ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <nav
        className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-ink/10 bg-paper/90 px-2 py-2 backdrop-blur-sm md:w-52 md:flex-col md:gap-0.5 md:border-b-0 md:border-r md:px-3 md:py-6"
        aria-label="アプリのメニュー"
      >
        <p className="hidden px-2 pb-3 font-serif text-lg tracking-tight text-ink md:block">凪</p>
        {APP_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end ?? false}
            className={({ isActive }) =>
              [
                "rounded-lg px-3 py-2 text-sm transition-colors duration-200",
                "whitespace-nowrap md:whitespace-normal",
                isActive
                  ? "bg-ink/12 font-medium text-ink"
                  : "text-ink/75 hover:bg-ink/6 hover:text-ink",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="min-h-0 min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
