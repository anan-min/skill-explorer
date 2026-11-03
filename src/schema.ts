import { z } from "zod";

export const Lang = z.enum(["go", "ts", "python"]);
export const LANG_LABELS: Record<z.infer<typeof Lang>, string> = { go: "Go", ts: "TS", python: "Python" };

export const Level = z.enum(["easy", "medium", "hard"]);

export const Variant = z.object({
  lang: Lang.nullable(),
  q: z.string().min(1),
  choices: z
    .array(z.string().min(1))
    .length(4)
    .refine((c) => new Set(c).size === c.length, "choices must be distinct"),
  answer: z.number().int().min(0).max(3),
  explain: z.string().min(1),
});

export const Concept = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  // Easy concepts are what the skill's summary names; Quick scan only asks these.
  level: Level,
  variants: z.array(Variant).refine((v) => v.length !== 1, "needs 0 or at least 2 variants"),
});

export const Skill = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  // One line on what the skill covers, shown as its scan row.
  summary: z.string().min(1),
  concepts: z.array(Concept),
});

export const GroupFile = z.object({
  group: z.object({ id: z.string().min(1), title: z.string().min(1) }),
  skills: z.array(Skill),
});

export type Level = z.infer<typeof Level>;
export type Variant = z.infer<typeof Variant>;
export type Concept = z.infer<typeof Concept>;
export type Skill = z.infer<typeof Skill>;
export type GroupFile = z.infer<typeof GroupFile>;
