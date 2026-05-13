import type { RelationshipTagId } from "../api/types.js";

export const RELATIONSHIP_TAG_OPTIONS: ReadonlyArray<{
  id: RelationshipTagId;
  label: string;
  hint: string;
}> = [
  { id: "family", label: "家族", hint: "暮らしの近さが中心のとき" },
  { id: "partners", label: "パートナー", hint: "二人の距離感が中心のとき" },
  { id: "friends", label: "友人", hint: "支え合いが中心のとき" },
  { id: "care", label: "介護や見守り", hint: "見守りの気配が中心のとき" },
  { id: "other", label: "その他", hint: "どれにも近くないとき" },
];
