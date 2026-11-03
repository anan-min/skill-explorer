import { z } from "zod";
import type { Concept, GroupFile } from "./schema.ts";

const Lang = z.enum(["go", "ts"]);
const StateSchema = z.enum(["fog", "gap", "claimed", "confirmed"]);
const ConceptProgress = z.object({
  state: StateSchema,
  // The quiz question behind a gap, so the gap list can show it again.
  seen: z.object({ variant: z.number().int(), choice: z.number().int() }).optional(),
  // Which scan button made this a gap ("Used it" is already `claimed`).
  scan: z.enum(["never", "name"]).optional(),
  tested: z.array(Lang).optional(),
});
const ProgressSchema = z.object({
  schemaVersion: z.literal(1),
  concepts: z.record(z.string(), ConceptProgress),
  // Set when a Quick scan or Quiz reaches the result, so leaving a run halfway doesn't count.
  finished: z.boolean().optional(),
});

export type State = z.infer<typeof StateSchema>;
export type Progress = z.infer<typeof ProgressSchema>;
export type LangPref = "go" | "ts" | "both";
export type ScanButton = "never" | "name" | "used";
export type Persona =
  { kind: "locked" } | { kind: "apprentice" } | { kind: "wanderer" } | { kind: "group"; id: string };

// A run scans this many concepts per topic, then checks at least one per topic.
const SCAN_PER_GROUP = 4;
const EXTRA_CHECKS = 3;
const MAX_CHECKS = 12;
// A topic passes at this strength.
const PASS_RATE = 0.6;
// Unverified claims count for less than verified ones, so claiming everything doesn't pay.
const WEIGHT = { confirmed: 1, claimed: 0.75, heard: 0.5 };

export const emptyProgress = (): Progress => ({ schemaVersion: 1, concepts: {} });

export const finishRun = (p: Progress): Progress => ({ ...p, finished: true });

export const stateOf = (p: Progress, id: string): State => p.concepts[id]?.state ?? "fog";

export function scan(p: Progress, concept: Concept, button: ScanButton): Progress {
  const { tested } = p.concepts[concept.id] ?? {};
  const next = button === "used" ? { state: "claimed" as const } : { state: "gap" as const, scan: button };
  return { ...p, concepts: { ...p.concepts, [concept.id]: { ...next, ...(tested && { tested }) } } };
}

export function scanAnswer(p: Progress, id: string): ScanButton | null {
  const c = p.concepts[id];
  if (c?.state === "claimed") return "used";
  return c?.scan ?? null;
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

export function scanSample(groups: GroupFile[], p: Progress, rand: () => number) {
  return groups.map((group) => ({
    group,
    concepts: shuffle(conceptsOf(group), rand)
      .sort((x, y) => Number(stateOf(p, x.id) !== "fog") - Number(stateOf(p, y.id) !== "fog"))
      .slice(0, SCAN_PER_GROUP),
  }));
}

const isHeard = (p: Progress, id: string) => stateOf(p, id) === "gap" && p.concepts[id]?.scan === "name";

// One check per topic (a Used claim, else a Heard, else its basic question), then
// EXTRA_CHECKS more claims, spread over the topics with the most left unchecked.
export function checkQueue(groups: GroupFile[], p: Progress, lang: LangPref, rand: () => number): Concept[] {
  const askable = (c: Concept) => pickVariant(c, p, lang, rand) !== null;
  const pools = groups.map((g) => {
    const concepts = shuffle(conceptsOf(g).filter(askable), rand);
    return {
      claims: concepts.filter((c) => stateOf(p, c.id) === "claimed"),
      heard: concepts.filter((c) => isHeard(p, c.id)),
      basic: concepts.filter((c) => c.basic && stateOf(p, c.id) !== "confirmed"),
    };
  });
  const picks = pools.flatMap((pool) => pool.claims.shift() ?? pool.heard.shift() ?? pool.basic.shift() ?? []);
  // Round-robin over the claim-heaviest topics, so extras spread instead of piling on one.
  const heavy = pools.filter((pool) => pool.claims.length).sort((x, y) => y.claims.length - x.claims.length);
  for (let i = 0, extra = 0; extra < EXTRA_CHECKS && heavy.some((pool) => pool.claims.length); i++) {
    const next = heavy[i % heavy.length].claims.shift();
    if (next) {
      picks.push(next);
      extra++;
    }
  }
  return shuffle(picks, rand).slice(0, MAX_CHECKS);
}

export const conceptsOf = (g: GroupFile): Concept[] => g.skills.flatMap((s) => s.concepts);

// A quiz answer leaves a concept confirmed (right) or a gap with `seen` (wrong).
const answered = (p: Progress, id: string) => stateOf(p, id) === "confirmed" || !!p.concepts[id]?.seen;

function score(p: Progress, id: string): number {
  const state = stateOf(p, id);
  if (state === "confirmed") return WEIGHT.confirmed;
  if (state === "claimed") return WEIGHT.claimed;
  return isHeard(p, id) ? WEIGHT.heard : 0;
}

// Average score of a topic's explored concepts: what the radar plots and the persona ranks.
export function strength(g: GroupFile, p: Progress): number {
  const explored = conceptsOf(g).filter((c) => stateOf(p, c.id) !== "fog");
  return explored.length ? explored.reduce((sum, c) => sum + score(p, c.id), 0) / explored.length : 0;
}

// A topic is scanned once its scan rows are answered: enough for a (self-reported) persona.
function scanned(g: GroupFile, p: Progress): boolean {
  const concepts = conceptsOf(g);
  return concepts.filter((c) => stateOf(p, c.id) !== "fog").length >= Math.min(SCAN_PER_GROUP, concepts.length);
}

// True once every topic that can be quizzed has a quiz answer, i.e. the result is checked, not just claimed.
export function allChecked(groups: GroupFile[], p: Progress): boolean {
  return groups.every((g) => {
    const concepts = conceptsOf(g);
    return !concepts.some((c) => c.variants.length) || concepts.some((c) => answered(p, c.id));
  });
}

export function persona(groups: GroupFile[], p: Progress): Persona {
  if (!groups.length || !groups.every((g) => scanned(g, p))) return { kind: "locked" };
  const rows = groups.map((g, order) => ({
    id: g.group.id,
    order,
    strength: strength(g, p),
    confirmed: conceptsOf(g).filter((c) => stateOf(p, c.id) === "confirmed").length,
  }));
  const passing = rows.filter((r) => r.strength >= PASS_RATE);
  if (!passing.length) return { kind: "apprentice" };
  if (passing.length === rows.length) return { kind: "wanderer" };
  const [top] = passing.sort((x, y) => y.strength - x.strength || y.confirmed - x.confirmed || x.order - y.order);
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

function statusLabel(p: Progress, id: string): string {
  const c = p.concepts[id];
  if (!c || c.state === "fog") return "Not explored";
  if (c.state === "confirmed") return "Confirmed";
  if (c.state === "claimed") return "Used";
  return c.seen ? "Missed" : c.scan === "name" ? "Heard" : "New";
}

const indent = (text: string) =>
  text
    .split("\n")
    .map((line) => (line ? `  ${line}` : ""))
    .join("\n");

// A Markdown file of every concept's status, with the question behind each Missed one.
// `personaName` is null while the persona is locked.
export function report(groups: GroupFile[], p: Progress, personaName: string | null): string {
  const who = personaName
    ? `Persona: **${personaName}** (${allChecked(groups, p) ? "checked by the quiz" : "self-reported; not checked by the quiz yet"})`
    : "Persona: not unlocked yet (finish a quick scan or a quiz)";
  const concept = (c: Concept) => {
    const line = `- **${c.title}**: ${statusLabel(p, c.id)}`;
    const seen = stateOf(p, c.id) === "gap" && p.concepts[c.id]?.seen;
    if (!seen) return line;
    const v = c.variants[seen.variant];
    const detail = [v.q, `You picked: ${v.choices[seen.choice]}\nAnswer: ${v.choices[v.answer]}`, v.explain];
    return `${line}\n\n${detail.map(indent).join("\n\n")}`;
  };
  const sections = groups.flatMap((g) => [
    `## ${g.group.title}`,
    ...g.skills.map((s) => {
      // A blank line after a Missed item's details, so the next bullet doesn't join them.
      const items = s.concepts.map(concept);
      const body = items.map((item, i) => (i && items[i - 1].includes("\n") ? `\n${item}` : item)).join("\n");
      return `### ${s.title}\n\n${body}`;
    }),
  ]);
  return [`# Nerdscape report`, who, ...sections].join("\n\n") + "\n";
}
