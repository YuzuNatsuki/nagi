import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShellLayout } from "../layouts/AppShellLayout.js";
import { RootLayout } from "../layouts/RootLayout.js";
import { AppAnnouncementsPage } from "../pages/AppAnnouncementsPage.js";
import { AppChatPage } from "../pages/AppChatPage.js";
import { AppHomePage } from "../pages/AppHomePage.js";
import { AppMembersPage } from "../pages/AppMembersPage.js";
import { AppMoodPage } from "../pages/AppMoodPage.js";
import { AppNotificationsPage } from "../pages/AppNotificationsPage.js";
import { AppPairsPage } from "../pages/AppPairsPage.js";
import { AppSettingsPage } from "../pages/AppSettingsPage.js";
import { AppWhisperPage } from "../pages/AppWhisperPage.js";
import { OnboardingChoicePage } from "../pages/OnboardingChoicePage.js";
import { OnboardingCreatePairPage } from "../pages/OnboardingCreatePairPage.js";
import { OnboardingEnterInvitePage } from "../pages/OnboardingEnterInvitePage.js";
import { OnboardingOwnerApprovePage } from "../pages/OnboardingOwnerApprovePage.js";
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
        <Route path="onboarding/pairs/:pairId/owner-approve" element={<OnboardingOwnerApprovePage />} />
        <Route path="onboarding/enter-invite" element={<OnboardingEnterInvitePage />} />
        <Route path="onboarding/pending-approval" element={<OnboardingPendingApprovalPage />} />
        <Route path="app" element={<AppShellLayout />}>
          <Route index element={<AppHomePage />} />
          <Route path="announcements" element={<AppAnnouncementsPage />} />
          <Route path="members" element={<AppMembersPage />} />
          <Route path="notifications" element={<AppNotificationsPage />} />
          <Route path="whisper" element={<AppWhisperPage />} />
          <Route path="chat" element={<AppChatPage />} />
          <Route path="mood" element={<AppMoodPage />} />
          <Route path="pairs" element={<AppPairsPage />} />
          <Route path="settings" element={<AppSettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
