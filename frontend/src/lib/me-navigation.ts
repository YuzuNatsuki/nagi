import type { MeResponse } from "../api/types.js";

export function routeAfterMe(me: MeResponse): "/onboarding" | "/onboarding/pending-approval" | "/app" {
  if (me.pair === null) {
    return "/onboarding";
  }
  if (me.pair.membershipState === "pending_owner_approval") {
    return "/onboarding/pending-approval";
  }
  return "/app";
}
