import { describe, expect, it } from "vitest";
import { isRelationshipTagId, RELATIONSHIP_TAG_IDS } from "./relationship-tags.js";

describe("relationship-tags", () => {
  it("定義されたタグだけを許可する", () => {
    expect(RELATIONSHIP_TAG_IDS.length).toBeGreaterThan(0);
    for (const id of RELATIONSHIP_TAG_IDS) {
      expect(isRelationshipTagId(id)).toBe(true);
    }
    expect(isRelationshipTagId("nope")).toBe(false);
  });
});
