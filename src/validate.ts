import { GroupFile } from "./schema.ts";

const MAX_CONCEPTS = 8;

export function validateContent(files: { name: string; data: unknown }[]) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const { name, data } of files) {
    const parsed = GroupFile.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push(`${name}: ${issue.path.join(".")}: ${issue.message}`);
      continue;
    }
    const { group, skills } = parsed.data;
    if (!new RegExp(`^\\d\\d-${group.id}\\.json$`).test(name)) {
      errors.push(`${name}: file name must be NN-${group.id}.json`);
    }
    if (!skills.some((s) => s.concepts.some((c) => c.level === "easy" && c.variants.length))) {
      errors.push(`${name}: needs at least one quizzable easy concept`);
    }
    for (const skill of skills) {
      if (!skill.concepts.some((c) => c.level === "easy" && c.variants.length)) {
        warnings.push(`${name}: skill ${skill.id} has no quizzable easy concept`);
      }
      if (skill.concepts.length > MAX_CONCEPTS) {
        warnings.push(`${name}: skill ${skill.id} has ${skill.concepts.length} concepts (aim for 4–${MAX_CONCEPTS})`);
      }
      const prefix = `${group.id}/${skill.id}/`;
      for (const { id } of skill.concepts) {
        if (!id.startsWith(prefix) || id.length === prefix.length || id.slice(prefix.length).includes("/")) {
          errors.push(`${name}: concept id ${id} must be ${prefix}<slug>`);
        }
        if (seen.has(id)) errors.push(`${name}: duplicate concept id ${id}`);
        seen.add(id);
      }
    }
  }
  return { errors, warnings };
}
