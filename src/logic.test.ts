import { describe, expect, it } from "vitest";
import type { Concept, GroupFile, Level, Variant } from "./schema.ts";
import {
  answer,
  claimsChecked,
  emptyProgress,
  finishRun,
  gapText,
  parseBackup,
  persona,
  pickVariant,
  quickChecks,
  quizChecks,
  rate,
  report,
  resultOf,
  skillScore,
  stats,
  strength,
  type Progress,
  type Rating,
} from "./logic.ts";

const v = (lang: Variant["lang"]): Variant => ({
  lang,
  q: `${lang} q`,
  choices: ["a", "b", "c", "d"],
  answer: 0,
  explain: "e",
});
const concept = (id: string, level: Level = "medium", langs: Variant["lang"][] = ["go", "ts"]): Concept => ({
  id,
  title: id,
  summary: `${id} summary`,
  level,
  variants: langs.map(v),
});
const scanOnly = (id: string): Concept => ({ ...concept(id, "easy"), variants: [] });

// A topic of skills, each skill a list of concepts; ids are `group/skill/concept`.
const group = (id: string, skills: Record<string, [string, Level][]>): GroupFile => ({
  group: { id, title: id.toUpperCase() },
  skills: Object.entries(skills).map(([sid, concepts]) => ({
    id: sid,
    title: sid.toUpperCase(),
    summary: `${sid} summary`,
    concepts: concepts.map(([cid, level]) => concept(`${id}/${sid}/${cid}`, level)),
  })),
});
const skill = (g: GroupFile, sid: string) => g.skills.find((s) => s.id === sid)!;
const find = (g: GroupFile, cid: string) => g.skills.flatMap((s) => s.concepts).find((c) => c.id.endsWith(`/${cid}`))!;

const rateAll = (p: Progress, g: GroupFile, ratings: Record<string, Rating>) =>
  Object.entries(ratings).reduce((acc, [sid, r]) => rate(acc, g, skill(g, sid), r), p);
const right = (p: Progress, c: Concept) => answer(p, c, 0, 0);
const wrong = (p: Progress, c: Concept) => answer(p, c, 0, 1);
const first = () => 0;
const ids = (checks: { concept: Concept }[]) => checks.map((c) => c.concept.id);

const g = group("g", {
  a: [
    ["a-easy", "easy"],
    ["a-med", "medium"],
    ["a-hard", "hard"],
  ],
  b: [
    ["b-easy", "easy"],
    ["b-med", "medium"],
  ],
});

describe("ratings and answers", () => {
  it("stores a rating per skill and the latest answer per concept", () => {
    let p = rate(emptyProgress(), g, skill(g, "a"), "heard");
    p = rate(p, g, skill(g, "a"), "used");
    expect(p.skills).toEqual({ "g/a": "used" });
    p = wrong(p, find(g, "a-easy"));
    expect(resultOf(p, find(g, "a-easy"))).toBe("wrong");
    p = right(p, find(g, "a-easy"));
    expect(resultOf(p, find(g, "a-easy"))).toBe("right");
    expect(resultOf(p, find(g, "a-med"))).toBeNull();
  });

  it("does not mutate the input", () => {
    const p = emptyProgress();
    rate(p, g, skill(g, "a"), "used");
    answer(p, find(g, "a-easy"), 0, 0);
    expect(p).toEqual(emptyProgress());
  });
});

describe("pickVariant", () => {
  it("restricts to the chosen language plus null variants", () => {
    const c = concept("c", "easy", ["go", "ts", null]);
    for (let i = 0; i < 20; i++) expect([1, 2]).toContain(pickVariant(c, "ts", Math.random));
  });

  it("returns null when nothing qualifies", () => {
    expect(pickVariant(concept("c", "easy", ["go", "go"]), "ts", first)).toBeNull();
    expect(pickVariant(scanOnly("c"), "ts", first)).toBeNull();
  });
});

describe("skillScore", () => {
  const a = skill(g, "a");

  it("is null until rated, then starts at New 0, Heard 0.4, Used 0.7", () => {
    expect(skillScore(g, a, emptyProgress())).toBeNull();
    expect(skillScore(g, a, rate(emptyProgress(), g, a, "new"))).toBe(0);
    expect(skillScore(g, a, rate(emptyProgress(), g, a, "heard"))).toBe(0.4);
    expect(skillScore(g, a, rate(emptyProgress(), g, a, "used"))).toBe(0.7);
  });

  it("moves by level: right easy/medium/hard +0.1/+0.15/+0.2, wrong −0.25/−0.15/−0.05", () => {
    const used = rate(emptyProgress(), g, a, "used");
    expect(skillScore(g, a, right(used, find(g, "a-easy")))).toBeCloseTo(0.8);
    expect(skillScore(g, a, wrong(used, find(g, "a-easy")))).toBeCloseTo(0.45);
    expect(skillScore(g, a, wrong(used, find(g, "a-hard")))).toBeCloseTo(0.65);
    const heard = rate(emptyProgress(), g, a, "heard");
    expect(skillScore(g, a, right(right(heard, find(g, "a-med")), find(g, "a-hard")))).toBeCloseTo(0.75);
  });

  it("counts only the latest answer per concept, and clamps to 0–1", () => {
    const used = rate(emptyProgress(), g, a, "used");
    expect(skillScore(g, a, right(wrong(used, find(g, "a-easy")), find(g, "a-easy")))).toBeCloseTo(0.8);
    const all = [find(g, "a-easy"), find(g, "a-med"), find(g, "a-hard")];
    expect(skillScore(g, a, all.reduce(right, used))).toBe(1);
    expect(skillScore(g, a, all.reduce(wrong, rate(emptyProgress(), g, a, "new")))).toBe(0);
  });
});

describe("strength", () => {
  it("averages the topic's rated skills", () => {
    const p = rateAll(emptyProgress(), g, { a: "used", b: "heard" });
    expect(strength(g, p)).toBeCloseTo(0.55);
    expect(strength(g, rate(emptyProgress(), g, skill(g, "a"), "used"))).toBeCloseTo(0.7);
    expect(strength(g, emptyProgress())).toBe(0);
  });
});

describe("quickChecks", () => {
  const h = group("h", { x: [["x-easy", "easy"]], y: [["y-med", "medium"]] });

  it("asks one easy question per topic, from a Used skill first, then Heard", () => {
    const p = rateAll(emptyProgress(), g, { a: "heard", b: "used" });
    expect(ids(quickChecks([g, h], p, "go", Math.random))).toEqual(["g/b/b-easy", "h/x/x-easy"]);
  });

  it("never asks a medium or hard question, and skips a topic with no easy one", () => {
    const only = group("o", { y: [["y-med", "medium"]] });
    expect(quickChecks([only], rate(emptyProgress(), only, skill(only, "y"), "used"), "go", first)).toEqual([]);
  });

  it("prefers an easy concept not asked before", () => {
    const two = group("t", {
      s: [
        ["one", "easy"],
        ["two", "easy"],
      ],
    });
    const p = right(rate(emptyProgress(), two, skill(two, "s"), "used"), find(two, "one"));
    for (let i = 0; i < 10; i++) expect(ids(quickChecks([two], p, "go", Math.random))).toEqual(["t/s/two"]);
  });

  it("skips concepts with no variant in the chosen language", () => {
    const goOnly: GroupFile = {
      group: { id: "l", title: "L" },
      skills: [{ id: "s", title: "S", summary: "s", concepts: [concept("l/s/c", "easy", ["go", "go"])] }],
    };
    expect(quickChecks([goOnly], emptyProgress(), "python", first)).toEqual([]);
    expect(ids(quickChecks([goOnly], emptyProgress(), "go", first))).toEqual(["l/s/c"]);
  });
});

describe("quizChecks", () => {
  it("climbs a skill's levels: easy first, medium once easy is right, then hard", () => {
    let p = rateAll(emptyProgress(), g, { a: "used", b: "new" });
    expect(ids(quizChecks([g], p, "go", Math.random))).toEqual(["g/a/a-easy"]);
    p = right(p, find(g, "a-easy"));
    expect(ids(quizChecks([g], p, "go", Math.random))).toEqual(["g/a/a-med"]);
    p = right(p, find(g, "a-med"));
    expect(ids(quizChecks([g], p, "go", Math.random))).toEqual(["g/a/a-hard"]);
  });

  it("stays at a level after a wrong answer", () => {
    const p = wrong(rateAll(emptyProgress(), g, { a: "used", b: "new" }), find(g, "a-easy"));
    expect(ids(quizChecks([g], p, "go", Math.random))).toEqual(["g/a/a-easy"]);
  });

  it("asks every claimed skill, Used before Heard, and never a New one in a topic with claims", () => {
    const three = group("t", { u: [["u", "easy"]], h: [["h", "easy"]], n: [["n", "easy"]] });
    const p = rateAll(emptyProgress(), three, { u: "used", h: "heard", n: "new" });
    expect(ids(quizChecks([three], p, "go", Math.random))).toEqual(["t/u/u", "t/h/h"]);
  });

  it("asks an easy question in a topic where nothing is claimed", () => {
    const p = rateAll(emptyProgress(), g, { a: "new", b: "new" });
    const q = ids(quizChecks([g], p, "go", Math.random));
    expect(q).toHaveLength(1);
    expect(["g/a/a-easy", "g/b/b-easy"]).toContain(q[0]);
  });

  it("caps a run at 18 questions, one per topic first", () => {
    const groups = Array.from({ length: 4 }, (_, i) =>
      group(`g${i}`, Object.fromEntries(Array.from({ length: 6 }, (_, s) => [`s${s}`, [[`c${s}`, "easy"]]]))),
    );
    const p = groups.reduce((acc, gr) => gr.skills.reduce((a2, s) => rate(a2, gr, s, "used"), acc), emptyProgress());
    const q = quizChecks(groups, p, "go", Math.random);
    expect(q).toHaveLength(18);
    expect(new Set(q.slice(0, 4).map((c) => c.concept.id.split("/")[0])).size).toBe(4);
  });
});

describe("persona", () => {
  const strong = group("strong", { s: [["s", "easy"]] });
  const weak = group("weak", { w: [["w", "easy"]] });

  it("stays locked until every skill is rated", () => {
    expect(persona([strong, weak], rate(emptyProgress(), strong, skill(strong, "s"), "used"))).toEqual({
      kind: "locked",
    });
  });

  it("is the Apprentice when no topic reaches 60%", () => {
    const p = rate(rate(emptyProgress(), strong, skill(strong, "s"), "heard"), weak, skill(weak, "w"), "new");
    expect(persona([strong, weak], p)).toEqual({ kind: "apprentice" });
  });

  it("is the Wanderer when every topic reaches 60%", () => {
    const p = rate(rate(emptyProgress(), strong, skill(strong, "s"), "used"), weak, skill(weak, "w"), "used");
    expect(persona([strong, weak], p)).toEqual({ kind: "wanderer" });
  });

  it("with one strong topic, is that topic's animal in its own job", () => {
    const p = rate(rate(emptyProgress(), strong, skill(strong, "s"), "used"), weak, skill(weak, "w"), "new");
    expect(persona([strong, weak], p)).toEqual({ kind: "group", id: "strong", job: "strong" });
  });

  it("otherwise is the strongest topic's animal in the second-strongest's job, ties broken by right answers then topic order", () => {
    const third = group("third", { t: [["t", "easy"]], u: [["u", "easy"]] });
    let p = rate(emptyProgress(), strong, skill(strong, "s"), "used");
    p = rate(p, weak, skill(weak, "w"), "new");
    p = rateAll(p, third, { t: "used", u: "used" });
    // Both 0.7: the earlier topic wins.
    expect(persona([strong, weak, third], p)).toEqual({ kind: "group", id: "strong", job: "third" });
    // Both 0.8, but third has two right answers.
    p = right(right(right(p, find(strong, "s")), find(third, "t")), find(third, "u"));
    expect(persona([strong, weak, third], p)).toEqual({ kind: "group", id: "third", job: "strong" });
    // Higher strength beats more right answers.
    p = right(p, find(strong, "s"));
    expect(persona([weak, third, strong], wrong(p, find(third, "u")))).toEqual({
      kind: "group",
      id: "strong",
      job: "third",
    });
  });
});

describe("claimsChecked and stats", () => {
  it("counts claimed skills with a question, and overall results", () => {
    let p = rateAll(emptyProgress(), g, { a: "used", b: "heard" });
    expect(claimsChecked([g], p)).toEqual({ checked: 0, claimed: 2 });
    p = wrong(right(p, find(g, "a-easy")), find(g, "a-med"));
    expect(claimsChecked([g], p)).toEqual({ checked: 1, claimed: 2 });
    expect(stats([g], p)).toEqual({ right: 1, missed: 1, used: 1, unrated: 0 });
  });
});

describe("gapText", () => {
  it("lists New, Heard and low-scoring skills with their missed questions, easy misses first", () => {
    let p = rateAll(emptyProgress(), g, { a: "used", b: "heard" });
    p = wrong(wrong(p, find(g, "a-hard")), find(g, "a-easy"));
    expect(gapText([g], p)).toBe(
      [
        "G",
        "  A (Used): a summary",
        "  - Missed (Easy) g/a/a-easy: g/a/a-easy summary",
        "  - Missed (Hard) g/a/a-hard: g/a/a-hard summary",
        "  B (Heard): b summary",
      ].join("\n"),
    );
  });

  it("leaves out strong skills with nothing missed", () => {
    expect(gapText([g], rateAll(emptyProgress(), g, { a: "used", b: "used" }))).toBe("");
  });
});

describe("report", () => {
  it("lists every skill's rating and score and every concept's result", () => {
    let p = rateAll(emptyProgress(), g, { a: "used", b: "new" });
    p = right(p, find(g, "a-easy"));
    const md = report([g], p, "Octopus · Interpreter");
    expect(md).toContain("Persona: **Octopus · Interpreter** (checked 1 of 1 claimed skills)");
    expect(md).toContain(
      "### A\n\nUsed · score 80%\n\n- **g/a/a-easy** (Easy): Right\n- **g/a/a-med** (Medium): Not asked",
    );
    expect(md).toContain("### B\n\nNew · score 0%");
  });

  it("shows the question, picked choice, answer and explanation for a missed concept", () => {
    const p = wrong(rateAll(emptyProgress(), g, { a: "used", b: "used" }), find(g, "a-easy"));
    const md = report([g], p, "X");
    expect(md).toContain(
      "- **g/a/a-easy** (Easy): Missed\n\n  go q\n\n  You picked: b\n  Answer: a\n\n  e\n\n- **g/a/a-med**",
    );
  });

  it("puts the persona's description under its name", () => {
    const md = report([g], rate(emptyProgress(), g, skill(g, "a"), "used"), "Mouse · Knight", "Sniffs out bugs.");
    expect(md).toContain("Persona: **Mouse · Knight** (checked 0 of 1 claimed skills)\n\n_Sniffs out bugs._");
  });

  it("says when there is no persona yet", () => {
    expect(report([g], emptyProgress(), null)).toContain("Persona: not unlocked yet");
  });
});

describe("backup", () => {
  it("round-trips, including a finished run", () => {
    const p = finishRun(right(rate(emptyProgress(), g, skill(g, "a"), "used"), find(g, "a-easy")));
    expect(parseBackup(JSON.stringify(p))).toEqual(p);
  });

  it("rejects junk and version-1 progress", () => {
    expect(() => parseBackup("nope")).toThrow();
    expect(() => parseBackup(JSON.stringify({ schemaVersion: 1, concepts: {} }))).toThrow();
  });
});
