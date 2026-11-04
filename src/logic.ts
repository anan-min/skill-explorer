import { z } from "zod";
import { Lang, type Concept, type GroupFile, type Level, type Skill } from "./schema.ts";

const RatingSchema = z.enum(["new", "heard", "used", "strong", "expert"]);
const AnswerSchema = z.object({ variant: z.number().int(), choice: z.number().int() });
const ProgressSchema = z.object({
  schemaVersion: z.literal(2),
  // Scan ratings, keyed by `<group id>/<skill id>`.
  skills: z.record(z.string(), RatingSchema),
  // The latest answer per concept, keyed by concept id.
  answers: z.record(z.string(), AnswerSchema),
  // Set when a Quick scan or Quiz reaches the result, so leaving a run halfway doesn't count.
  finished: z.boolean().optional(),
});

export type Rating = z.infer<typeof RatingSchema>;
export type Progress = z.infer<typeof ProgressSchema>;
export type LangPref = z.infer<typeof Lang>;
export type Check = { concept: Concept; variant: number };
export type Persona =
  | { kind: "locked" }
  | { kind: "apprentice" }
  | { kind: "wanderer" }
  // The strongest topic's animal in the second-strongest topic's job (its own job if only one is strong).
  | { kind: "group"; id: string; job: string };

// Quiz length; Quick scan asks one easy question per topic.
const QUIZ_CHECKS = 18;
// A topic passes at this strength, and only with no more missed answers than right ones.
const PASS_RATE = 0.6;
// When no topic passes, topics from this strength (same miss rule) still pick the nerd, so the
// Chick is for people who are new or missed a lot, not everyone short of 60%.
const LEAN_RATE = 0.4;
// The Wanderer needs this many passing topics (capped at the number of topics).
const WANDERER_AT = 5;
// A skill below this, or rated New or Heard, shows in the gap list.
const GAP_BELOW = 0.5;
// A skill's score starts from its rating, then each answered concept moves it.
// Missing an easy question says the most; missing a hard one, little.
// Ratings start low enough that only right answers make a skill strong: Used plus one lucky
// easy guess is 60%, not 80%.
export const START: Record<Rating, number> = { new: 0, heard: 0.3, used: 0.5, strong: 0.6, expert: 0.7 };
// Ratings that claim hands-on use, highest first.
const USED: Rating[] = ["expert", "strong", "used"];
export const DELTA: Record<Level, { right: number; wrong: number }> = {
  easy: { right: 0.1, wrong: -0.4 },
  medium: { right: 0.2, wrong: -0.3 },
  hard: { right: 0.3, wrong: -0.15 },
};
// While a miss stands, the skill can't score above what it showed: missing an easy question
// means Heard at most, so the bigger the claim, the further it falls.
export const CAP: Record<Level, number> = { easy: START.heard, medium: 0.4, hard: START.used };
const LEVELS: Level[] = ["easy", "medium", "hard"];

export const emptyProgress = (): Progress => ({ schemaVersion: 2, skills: {}, answers: {} });

export const finishRun = (p: Progress): Progress => ({ ...p, finished: true });

export const skillKey = (g: GroupFile, s: Skill) => `${g.group.id}/${s.id}`;

export const ratingOf = (p: Progress, g: GroupFile, s: Skill): Rating | null => p.skills[skillKey(g, s)] ?? null;

export const rate = (p: Progress, g: GroupFile, s: Skill, rating: Rating): Progress => ({
  ...p,
  skills: { ...p.skills, [skillKey(g, s)]: rating },
});

// The "I don't know" choice. It counts as a miss for the topic rule and the gap list, but costs
// half a wrong answer's penalty and skips the cap, so admitting it always beats a wrong guess.
// With the cap, a Strong or Expert claim would score the same either way and guessing would win.
export const DONT_KNOW = -1;
export const choiceLabel = (v: Concept["variants"][number], choice: number) =>
  choice === DONT_KNOW ? "I don't know" : v.choices[choice];

export const answer = (p: Progress, concept: Concept, variant: number, choice: number): Progress => ({
  ...p,
  answers: { ...p.answers, [concept.id]: { variant, choice } },
});

// Right or wrong on the latest answer, or null if the concept hasn't been asked.
export function resultOf(p: Progress, c: Concept): "right" | "wrong" | null {
  const a = p.answers[c.id];
  const v = a && c.variants[a.variant];
  if (!v) return null;
  return a.choice === v.answer ? "right" : "wrong";
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickVariant(concept: Concept, lang: LangPref, rand: () => number): number | null {
  const eligible = concept.variants.map((v, i) => ({ v, i })).filter(({ v }) => v.lang === null || v.lang === lang);
  if (!eligible.length) return null;
  return eligible[Math.floor(rand() * eligible.length)].i;
}

const askable = (c: Concept, lang: LangPref) => c.variants.some((v) => v.lang === null || v.lang === lang);

// A concept at the skill's next level to prove (or `level` for Quick scan), not asked before if possible.
function pickConcept(s: Skill, p: Progress, lang: LangPref, rand: () => number, only?: Level): Concept | null {
  const passed = (level: Level) => s.concepts.some((c) => c.level === level && resultOf(p, c) === "right");
  const next = LEVELS.find((level) => !passed(level)) ?? "hard";
  // Try the next level, then the others nearest to it.
  const order = only ? [only] : [next, ...LEVELS.filter((l) => l !== next)];
  for (const level of order) {
    const pool = shuffle(
      s.concepts.filter((c) => c.level === level && askable(c, lang)),
      rand,
    );
    const fresh = pool.find((c) => resultOf(p, c) === null);
    if (fresh ?? pool[0]) return fresh ?? pool[0];
  }
  return null;
}

const check = (concept: Concept, lang: LangPref, rand: () => number): Check => ({
  concept,
  variant: pickVariant(concept, lang, rand)!,
});

// A topic's skills, Expert, Strong and Used first, then Heard, then the rest, each level shuffled.
function byClaim(g: GroupFile, p: Progress, rand: () => number) {
  const of = (r: Rating | null) =>
    shuffle(
      g.skills.filter((s) => ratingOf(p, g, s) === r),
      rand,
    );
  return { used: USED.flatMap(of), heard: of("heard"), rest: [...of("new"), ...of(null)] };
}

// Quick scan: one easy question per topic, from its most-claimed skill that has one.
export function quickChecks(groups: GroupFile[], p: Progress, lang: LangPref, rand: () => number): Check[] {
  return groups.flatMap((g) => {
    const { used, heard, rest } = byClaim(g, p, rand);
    for (const s of [...used, ...heard, ...rest]) {
      const c = pickConcept(s, p, lang, rand, "easy");
      if (c) return [check(c, lang, rand)];
    }
    return [];
  });
}

// Quiz: one question per topic from a claimed skill (or an easy one if nothing is claimed),
// then the other claimed skills, Used or higher before Heard, up to QUIZ_CHECKS. Each skill's question
// is at the next level it hasn't proved, so repeat runs climb.
export function quizChecks(groups: GroupFile[], p: Progress, lang: LangPref, rand: () => number): Check[] {
  const picks: Check[] = [];
  const extraUsed: [GroupFile, Skill][] = [];
  const extraHeard: [GroupFile, Skill][] = [];
  for (const g of groups) {
    const { used, heard, rest } = byClaim(g, p, rand);
    const claimed = [...used, ...heard];
    let first: Skill | undefined;
    for (const s of claimed) {
      const c = pickConcept(s, p, lang, rand);
      if (c) {
        picks.push(check(c, lang, rand));
        first = s;
        break;
      }
    }
    if (!first) {
      for (const s of rest) {
        const c = pickConcept(s, p, lang, rand, "easy");
        if (c) {
          picks.push(check(c, lang, rand));
          break;
        }
      }
    }
    extraUsed.push(...used.filter((s) => s !== first).map((s): [GroupFile, Skill] => [g, s]));
    extraHeard.push(...heard.filter((s) => s !== first).map((s): [GroupFile, Skill] => [g, s]));
  }
  const rank = ([g, s]: [GroupFile, Skill]) => USED.indexOf(ratingOf(p, g, s)!);
  const byRating = shuffle(extraUsed, rand).sort((x, y) => rank(x) - rank(y));
  for (const [, s] of [...byRating, ...shuffle(extraHeard, rand)]) {
    if (picks.length >= QUIZ_CHECKS) break;
    const c = pickConcept(s, p, lang, rand);
    if (c) picks.push(check(c, lang, rand));
  }
  return picks.slice(0, QUIZ_CHECKS);
}

export const conceptsOf = (g: GroupFile): Concept[] => g.skills.flatMap((s) => s.concepts);

// The skill's rating, moved by each answered concept; null until rated.
export function skillScore(g: GroupFile, s: Skill, p: Progress): number | null {
  const rating = ratingOf(p, g, s);
  if (!rating) return null;
  const moved = s.concepts.reduce((sum, c) => {
    const result = resultOf(p, c);
    if (!result) return sum;
    const unsure = p.answers[c.id].choice === DONT_KNOW;
    return sum + DELTA[c.level][result] * (unsure ? 0.5 : 1);
  }, START[rating]);
  const guessedWrong = (c: Concept) => resultOf(p, c) === "wrong" && p.answers[c.id].choice !== DONT_KNOW;
  const cap = Math.min(1, ...s.concepts.filter(guessedWrong).map((c) => CAP[c.level]));
  return Math.min(cap, Math.max(0, moved));
}

export const isChecked = (s: Skill, p: Progress) => s.concepts.some((c) => resultOf(p, c) !== null);

// Average score of a topic's rated skills: what the radar plots and the persona ranks.
export function strength(g: GroupFile, p: Progress): number {
  const scores = g.skills.map((s) => skillScore(g, s, p)).filter((n) => n !== null);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

const scanned = (g: GroupFile, p: Progress) => g.skills.every((s) => ratingOf(p, g, s));

// How many skills rated Heard or higher have had a question.
export function claimsChecked(groups: GroupFile[], p: Progress) {
  const claimed = groups.flatMap((g) => g.skills.filter((s) => (ratingOf(p, g, s) ?? "new") !== "new"));
  return { checked: claimed.filter((s) => isChecked(s, p)).length, claimed: claimed.length };
}

// The dex page explains the persona rule with these.
export { LEAN_RATE, PASS_RATE, WANDERER_AT };

export function persona(groups: GroupFile[], p: Progress): Persona {
  if (!groups.length || !groups.every((g) => scanned(g, p))) return { kind: "locked" };
  const rows = groups.map((g, order) => ({
    id: g.group.id,
    order,
    strength: strength(g, p),
    right: conceptsOf(g).filter((c) => resultOf(p, c) === "right").length,
    missed: conceptsOf(g).filter((c) => resultOf(p, c) === "wrong").length,
  }));
  const fair = rows.filter((r) => r.missed <= r.right);
  const passing = fair.filter((r) => r.strength >= PASS_RATE);
  if (passing.length >= Math.min(WANDERER_AT, rows.length)) return { kind: "wanderer" };
  const pool = passing.length ? passing : fair.filter((r) => r.strength >= LEAN_RATE);
  if (!pool.length) return { kind: "apprentice" };
  const [top, second] = pool.sort((x, y) => y.strength - x.strength || y.right - x.right || x.order - y.order);
  return { kind: "group", id: top.id, job: (second ?? top).id };
}

export function stats(groups: GroupFile[], p: Progress) {
  const all = groups.flatMap(conceptsOf);
  const ratings = groups.flatMap((g) => g.skills.map((s) => ratingOf(p, g, s)));
  return {
    right: all.filter((c) => resultOf(p, c) === "right").length,
    missed: all.filter((c) => resultOf(p, c) === "wrong").length,
    used: ratings.filter((r) => r !== null && USED.includes(r)).length,
    unrated: ratings.filter((r) => r === null).length,
  };
}

// Skills rated New or Heard or scoring under GAP_BELOW, and every missed question, by topic.
export function gapsByGroup(groups: GroupFile[], p: Progress) {
  return groups
    .map((g) => {
      const skills = g.skills
        .map((skill) => {
          const rating = ratingOf(p, g, skill);
          const score = skillScore(g, skill, p);
          const missed = skill.concepts
            .filter((c) => resultOf(p, c) === "wrong")
            .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
          const weak = rating === "new" || rating === "heard" || (score !== null && score < GAP_BELOW);
          return { skill, rating, score, missed, weak };
        })
        .filter((s) => s.weak || s.missed.length);
      return { group: g, skills, count: skills.reduce((n, s) => n + Math.max(1, s.missed.length), 0) };
    })
    .filter((g) => g.skills.length)
    .sort((a, b) => b.count - a.count);
}

const RATING_LABEL: Record<Rating, string> = {
  new: "New",
  heard: "Heard",
  used: "Used",
  strong: "Strong",
  expert: "Expert",
};
const LEVEL_LABEL: Record<Level, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export function gapText(groups: GroupFile[], p: Progress): string {
  return gapsByGroup(groups, p)
    .map(({ group, skills }) =>
      [
        group.group.title,
        ...skills.flatMap(({ skill, rating, missed }) => [
          `  ${skill.title}${rating ? ` (${RATING_LABEL[rating]})` : ""}: ${skill.summary}`,
          ...missed.map((c) => `  - Missed (${LEVEL_LABEL[c.level]}) ${c.title}: ${c.summary}`),
        ]),
      ].join("\n"),
    )
    .join("\n\n");
}

export const parseBackup = (text: string): Progress => ProgressSchema.parse(JSON.parse(text));

const indent = (text: string) =>
  text
    .split("\n")
    .map((line) => (line ? `  ${line}` : ""))
    .join("\n");

// A Markdown file of every skill's rating and score and every concept's result, with the question
// behind each missed one. `personaName` is null while the persona is locked.
export function report(groups: GroupFile[], p: Progress, personaName: string | null, tagline?: string): string {
  const { checked, claimed } = claimsChecked(groups, p);
  const who = personaName
    ? `Persona: **${personaName}** (checked ${checked} of ${claimed} claimed skills)${tagline ? `\n\n_${tagline}_` : ""}`
    : "Persona: not unlocked yet (finish a quick scan or a quiz)";
  const concept = (c: Concept) => {
    const result = resultOf(p, c);
    const status = result === "right" ? "Right" : result === "wrong" ? "Missed" : "Not asked";
    const line = `- **${c.title}** (${LEVEL_LABEL[c.level]}): ${status}`;
    const a = p.answers[c.id];
    if (result !== "wrong" || !a) return line;
    const v = c.variants[a.variant];
    const detail = [v.q, `You picked: ${choiceLabel(v, a.choice)}\nAnswer: ${v.choices[v.answer]}`, v.explain];
    return `${line}\n\n${detail.map(indent).join("\n\n")}`;
  };
  const sections = groups.flatMap((g) => [
    `## ${g.group.title}`,
    ...g.skills.map((s) => {
      const rating = ratingOf(p, g, s);
      const score = skillScore(g, s, p);
      const head = rating ? `${RATING_LABEL[rating]} · score ${Math.round(score! * 100)}%` : "Not rated";
      // A blank line after a Missed item's details, so the next bullet doesn't join them.
      const items = s.concepts.map(concept);
      const body = items.map((item, i) => (i && items[i - 1].includes("\n") ? `\n${item}` : item)).join("\n");
      return `### ${s.title}\n\n${head}\n\n${body}`;
    }),
  ]);
  return [`# Nerdscape report`, who, ...sections].join("\n\n") + "\n";
}
