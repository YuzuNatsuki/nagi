/**
 * 関係性タグ（API とフロントで値を一致させる）
 */
export const RELATIONSHIP_TAG_IDS = [
  "family",
  "partners",
  "friends",
  "care",
  "other",
] as const;

export type RelationshipTagId = (typeof RELATIONSHIP_TAG_IDS)[number];

export function isRelationshipTagId(value: string): value is RelationshipTagId {
  return (RELATIONSHIP_TAG_IDS as readonly string[]).includes(value);
}
