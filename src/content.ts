import { GroupFile } from "./schema.ts";

const real = import.meta.glob("../content/*.json", { eager: true, import: "default" });
// Placeholder topics for trying the app locally; never in a production build.
const dev = import.meta.env.DEV ? import.meta.glob("../dev-content/*.json", { eager: true, import: "default" }) : {};

const parse = (files: Record<string, unknown>) =>
  Object.entries(files).map(([path, data]) => ({ name: path.split("/").pop()!, file: GroupFile.parse(data) }));

const realGroups = parse(real);
const realIds = new Set(realGroups.map((g) => g.file.group.id));

// File names start with the group number, so sorting by name gives group order.
// A real file for a topic replaces its dev placeholder.
export const GROUPS: GroupFile[] = [...realGroups, ...parse(dev).filter((g) => !realIds.has(g.file.group.id))]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((g) => g.file);

export const groupById = (id: string) => GROUPS.find((g) => g.group.id === id);

// Concept IDs start with their group ID.
export const groupTitleOf = (conceptId: string) => groupById(conceptId.split("/")[0])?.group.title ?? "";
