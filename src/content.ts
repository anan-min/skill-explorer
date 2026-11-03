import { GroupFile } from "./schema.ts";

const files = import.meta.glob("../content/*.json", { eager: true, import: "default" });

// File names start with the group number, so sorting by path gives group order.
export const GROUPS: GroupFile[] = Object.keys(files)
  .sort()
  .map((path) => GroupFile.parse(files[path]));

export const groupById = (id: string) => GROUPS.find((g) => g.group.id === id);

// Concept IDs start with their group ID.
export const groupTitleOf = (conceptId: string) => groupById(conceptId.split("/")[0])?.group.title ?? "";
