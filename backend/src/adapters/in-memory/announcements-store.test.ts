import { describe, expect, it } from "vitest";
import { listAnnouncementEntries } from "./announcements-store.js";

describe("announcements-store", () => {
  it("お知らせが一通以上ある", () => {
    const rows = listAnnouncementEntries();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]?.id).toBeTruthy();
    expect(rows[0]?.title.length).toBeGreaterThan(0);
  });
});
