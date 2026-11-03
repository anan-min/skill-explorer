import { GroupFile } from "./schema.ts";

const files = import.meta.glob("../content/*.json", { eager: true, import: "default" });

// File names start with the group number, so sorting by name gives group order.
export const GROUPS: GroupFile[] = Object.entries(files)
  .map(([path, data]) => ({ name: path.split("/").pop()!, file: GroupFile.parse(data) }))
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((g) => g.file);

export const groupById = (id: string) => GROUPS.find((g) => g.group.id === id);

// Concept IDs start with their group ID.
export const groupTitleOf = (conceptId: string) => groupById(conceptId.split("/")[0])?.group.title ?? "";
