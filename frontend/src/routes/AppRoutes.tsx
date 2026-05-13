import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RootLayout } from "../layouts/RootLayout.js";
import { AppHomePage } from "../pages/AppHomePage.js";
import { OnboardingChoicePage } from "../pages/OnboardingChoicePage.js";
import { OnboardingCreatePairPage } from "../pages/OnboardingCreatePairPage.js";
import { OnboardingEnterInvitePage } from "../pages/OnboardingEnterInvitePage.js";
import { OnboardingPairInvitePage } from "../pages/OnboardingPairInvitePage.js";
import { OnboardingPendingApprovalPage } from "../pages/OnboardingPendingApprovalPage.js";
import { RootIndexPage } from "../pages/RootIndexPage.js";

export function AppRoutes(): ReactElement {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<RootIndexPage />} />
        <Route path="onboarding" element={<OnboardingChoicePage />} />
        <Route path="onboarding/create-pair" element={<OnboardingCreatePairPage />} />
        <Route path="onboarding/pairs/:pairId/invite" element={<OnboardingPairInvitePage />} />
        <Route path="onboarding/enter-invite" element={<OnboardingEnterInvitePage />} />
        <Route path="onboarding/pending-approval" element={<OnboardingPendingApprovalPage />} />
        <Route path="app" element={<AppHomePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
