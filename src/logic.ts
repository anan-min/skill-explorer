import { z } from "zod";
import type { Concept, GroupFile } from "./schema.ts";

const Lang = z.enum(["go", "ts"]);
const StateSchema = z.enum(["fog", "gap", "claimed", "confirmed"]);
const ConceptProgress = z.object({
  state: StateSchema,
  // The quiz question behind a gap, so the gap list can show it again.
  seen: z.object({ variant: z.number().int(), choice: z.number().int() }).optional(),
  tested: z.array(Lang).optional(),
});
const ProgressSchema = z.object({
  schemaVersion: z.literal(1),
  concepts: z.record(z.string(), ConceptProgress),
});

export type State = z.infer<typeof StateSchema>;
export type Progress = z.infer<typeof ProgressSchema>;
export type LangPref = "go" | "ts" | "both";
export type ScanButton = "never" | "name" | "used";
export type Persona =
  { kind: "locked" } | { kind: "apprentice" } | { kind: "wanderer" } | { kind: "group"; id: string };

// A session samples this many concepts from every group, so one session reads every group.
const PER_GROUP = 2;
// A group passes at MIN_ANSWERS quiz answers with at least PASS_RATE of them right.
const MIN_ANSWERS = 2;
const PASS_RATE = 0.6;

export const emptyProgress = (): Progress => ({ schemaVersion: 1, concepts: {} });

export const stateOf = (p: Progress, id: string): State => p.concepts[id]?.state ?? "fog";

export function scan(p: Progress, concept: Concept, button: ScanButton): Progress {
  const { tested } = p.concepts[concept.id] ?? {};
  const state = button === "used" ? "claimed" : "gap";
  return { ...p, concepts: { ...p.concepts, [concept.id]: { state, ...(tested && { tested }) } } };
}

export function answer(p: Progress, concept: Concept, variant: number, choice: number): Progress {
  const v = concept.variants[variant];
  const prev = p.concepts[concept.id]?.tested ?? [];
  const tested = v.lang && !prev.includes(v.lang) ? [...prev, v.lang] : prev;
  const next =
    choice === v.answer ? { state: "confirmed" as const } : { state: "gap" as const, seen: { variant, choice } };
  return { ...p, concepts: { ...p.concepts, [concept.id]: { ...next, ...(tested.length && { tested }) } } };
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickVariant(concept: Concept, p: Progress, lang: LangPref, rand: () => number): number | null {
  const eligible = concept.variants
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => lang === "both" || v.lang === null || v.lang === lang);
  if (!eligible.length) return null;
  const tested = p.concepts[concept.id]?.tested ?? [];
  const untested = lang === "both" ? eligible.filter(({ v }) => v.lang && !tested.includes(v.lang)) : [];
  const pool = untested.length ? untested : eligible;
  return pool[Math.floor(rand() * pool.length)].i;
}

const PRIORITY: State[] = ["claimed", "fog", "gap"];

// Up to PER_GROUP concepts from each group, best-first by `rank`, then shuffled across groups.
function sample(groups: GroupFile[], rank: (c: Concept) => number, rand: () => number): Concept[] {
  const picks = groups.flatMap((g) =>
    shuffle(
      conceptsOf(g).filter((c) => rank(c) >= 0),
      rand,
    )
      .sort((x, y) => rank(x) - rank(y))
      .slice(0, PER_GROUP),
  );
  return shuffle(picks, rand);
}

export function quizQueue(groups: GroupFile[], p: Progress, lang: LangPref, rand: () => number): Concept[] {
  return sample(
    groups,
    (c) => (pickVariant(c, p, lang, rand) === null ? -1 : PRIORITY.indexOf(stateOf(p, c.id))),
    rand,
  );
}

export function expressQueue(groups: GroupFile[], p: Progress, rand: () => number): Concept[] {
  return sample(groups, (c) => (stateOf(p, c.id) === "fog" ? 0 : 1), rand);
}

export const conceptsOf = (g: GroupFile): Concept[] => g.skills.flatMap((s) => s.concepts);

// A quiz answer leaves a concept confirmed (right) or a gap with `seen` (wrong).
const answered = (p: Progress, id: string) => stateOf(p, id) === "confirmed" || !!p.concepts[id]?.seen;

// Share of a group's quiz answers that were right: what the radar plots.
export function strength(g: GroupFile, p: Progress): number {
  const done = conceptsOf(g).filter((c) => answered(p, c.id));
  return done.length ? done.filter((c) => stateOf(p, c.id) === "confirmed").length / done.length : 0;
}

export function persona(groups: GroupFile[], p: Progress): Persona {
  const rows = groups
    .map((g, order) => {
      const ids = conceptsOf(g)
        .filter((c) => c.variants.length)
        .map((c) => c.id);
      const done = ids.filter((id) => answered(p, id));
      const correct = done.filter((id) => stateOf(p, id) === "confirmed").length;
      return { id: g.group.id, order, quizzable: ids.length, answered: done.length, correct };
    })
    // A group with too few quiz questions can never reach MIN_ANSWERS, so it can't hold the persona back.
    .filter((r) => r.quizzable >= MIN_ANSWERS);
  if (!rows.length || rows.some((r) => r.answered < MIN_ANSWERS)) return { kind: "locked" };
  // Integer comparison so 3 of 5 is exactly 60%.
  const passing = rows.filter((r) => r.correct * 100 >= r.answered * PASS_RATE * 100);
  if (!passing.length) return { kind: "apprentice" };
  if (passing.length === rows.length) return { kind: "wanderer" };
  const [top] = passing.sort(
    (x, y) => y.correct * x.answered - x.correct * y.answered || y.correct - x.correct || x.order - y.order,
  );
  return { kind: "group", id: top.id };
}

export function stats(groups: GroupFile[], p: Progress) {
  const all = groups.flatMap(conceptsOf);
  const count = (state: State) => all.filter((c) => stateOf(p, c.id) === state).length;
  return {
    correct: count("confirmed"),
    wrong: all.filter((c) => p.concepts[c.id]?.seen && stateOf(p, c.id) === "gap").length,
    used: count("claimed"),
    gaps: count("gap"),
    unexplored: count("fog"),
    groups: groups.map((g) => {
      const concepts = conceptsOf(g);
      return {
        id: g.group.id,
        title: g.group.title,
        correct: concepts.filter((c) => stateOf(p, c.id) === "confirmed").length,
        answered: concepts.filter((c) => answered(p, c.id)).length,
        explored: concepts.filter((c) => stateOf(p, c.id) !== "fog").length,
        total: concepts.length,
      };
    }),
  };
}

export function gapsByGroup(groups: GroupFile[], p: Progress) {
  return groups
    .map((g) => {
      const skills = g.skills
        .map((s) => ({ skill: s, gaps: s.concepts.filter((c) => stateOf(p, c.id) === "gap") }))
        .filter((s) => s.gaps.length);
      return { group: g, skills, count: skills.reduce((n, s) => n + s.gaps.length, 0) };
    })
    .filter((g) => g.count)
    .sort((a, b) => b.count - a.count);
}

export function gapText(groups: GroupFile[], p: Progress): string {
  return gapsByGroup(groups, p)
    .map(({ group, skills }) =>
      [
        group.group.title,
        ...skills.flatMap(({ skill, gaps }) => [
          `  ${skill.title}`,
          ...gaps.map((c) => `  - ${c.title}: ${c.summary}`),
        ]),
      ].join("\n"),
    )
    .join("\n\n");
}

export const parseBackup = (text: string): Progress => ProgressSchema.parse(JSON.parse(text));
