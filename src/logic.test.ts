import { describe, expect, it } from "vitest";
import type { Concept, GroupFile, Variant } from "./schema.ts";
import {
  allChecked,
  answer,
  emptyProgress,
  gapText,
  parseBackup,
  persona,
  pickVariant,
  checkQueue,
  report,
  scanSample,
  scan,
  scanAnswer,
  stateOf,
  stats,
  strength,
  type Progress,
  type State,
} from "./logic.ts";

const v = (lang: Variant["lang"]): Variant => ({
  lang,
  q: `${lang} q`,
  choices: ["a", "b", "c", "d"],
  answer: 0,
  explain: "e",
});
const quizzable = (id: string, langs: Variant["lang"][] = ["go", "ts"]): Concept => ({
  id,
  title: id,
  summary: `${id} summary`,
  variants: langs.map(v),
});
const scanOnly = (id: string): Concept => ({ id, title: id, summary: `${id} summary`, variants: [] });

const group = (id: string, concepts: Concept[]): GroupFile => ({
  group: { id, title: id.toUpperCase() },
  skills: [{ id: "s", title: "Skill S", concepts }],
});

const withStates = (states: Record<string, State>): Progress => ({
  ...emptyProgress(),
  concepts: Object.fromEntries(Object.entries(states).map(([id, state]) => [id, { state }])),
});

const first = () => 0;

describe("states", () => {
  it("defaults to fog", () => {
    expect(stateOf(emptyProgress(), "x")).toBe("fog");
  });

  it("maps scan buttons to states", () => {
    const c = quizzable("c");
    expect(stateOf(scan(emptyProgress(), c, "never"), "c")).toBe("gap");
    expect(stateOf(scan(emptyProgress(), c, "name"), "c")).toBe("gap");
    expect(stateOf(scan(emptyProgress(), c, "used"), "c")).toBe("claimed");
  });

  it("confirms on a correct answer and records a gap with what was seen on a wrong one", () => {
    const c = quizzable("c");
    expect(stateOf(answer(emptyProgress(), c, 1, 0), "c")).toBe("confirmed");
    const wrong = answer(emptyProgress(), c, 1, 2);
    expect(wrong.concepts.c).toEqual({ state: "gap", seen: { variant: 1, choice: 2 }, tested: ["ts"] });
  });

  it("lets later answers move a concept between states", () => {
    const c = quizzable("c");
    const p = answer(scan(emptyProgress(), c, "used"), c, 0, 3);
    expect(stateOf(p, "c")).toBe("gap");
    const fixed = answer(p, c, 1, 0);
    expect(stateOf(fixed, "c")).toBe("confirmed");
    expect(fixed.concepts.c.seen).toBeUndefined();
    expect(stateOf(scan(fixed, c, "never"), "c")).toBe("gap");
  });

  it("remembers which scan answer was given, so a list can show it", () => {
    const c = quizzable("c");
    expect(scanAnswer(emptyProgress(), "c")).toBeNull();
    expect(scanAnswer(scan(emptyProgress(), c, "never"), "c")).toBe("never");
    expect(scanAnswer(scan(emptyProgress(), c, "name"), "c")).toBe("name");
    expect(scanAnswer(scan(emptyProgress(), c, "used"), "c")).toBe("used");
    // A quiz answer replaces the scan answer.
    expect(scanAnswer(answer(scan(emptyProgress(), c, "name"), c, 0, 0), "c")).toBeNull();
    expect(scanAnswer(answer(scan(emptyProgress(), c, "name"), c, 0, 1), "c")).toBeNull();
  });

  it("round-trips a scan answer through backup", () => {
    const p = scan(emptyProgress(), quizzable("c"), "name");
    expect(parseBackup(JSON.stringify(p))).toEqual(p);
  });

  it("does not mutate the input", () => {
    const p = emptyProgress();
    scan(p, quizzable("c"), "used");
    expect(p.concepts).toEqual({});
  });
});

describe("pickVariant", () => {
  it("with Both, prefers a language not yet tested", () => {
    const c = quizzable("c", ["go", "ts"]);
    const p = answer(emptyProgress(), c, 0, 1);
    expect(pickVariant(c, p, "both", first)).toBe(1);
  });

  it("with Both and every language tested, picks from all", () => {
    const c = quizzable("c", ["go", "ts"]);
    const p = answer(answer(emptyProgress(), c, 0, 1), c, 1, 1);
    expect([0, 1]).toContain(pickVariant(c, p, "both", Math.random));
  });

  it("restricts to the chosen language plus null variants", () => {
    const c = quizzable("c", ["go", "ts", null]);
    for (let i = 0; i < 20; i++) expect([1, 2]).toContain(pickVariant(c, emptyProgress(), "ts", Math.random));
  });

  it("returns null when nothing qualifies", () => {
    expect(pickVariant(quizzable("c", ["go", "go"]), emptyProgress(), "ts", first)).toBeNull();
    expect(pickVariant(scanOnly("c"), emptyProgress(), "both", first)).toBeNull();
  });
});

// A group "g" with concepts g1..gN; the first is basic.
const topic = (id: string, n: number, over: Partial<Concept> = {}) =>
  group(
    id,
    Array.from({ length: n }, (_, i) => ({ ...quizzable(`${id}${i + 1}`), basic: i === 0, ...over })),
  );
const heard = (...ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, { state: "gap" as const, scan: "name" as const }]));
const fresh = (...ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, { state: "gap" as const, scan: "never" as const }]));
const used = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, { state: "claimed" as const }]));
const right = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, { state: "confirmed" as const }]));
const wrong = (...ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, { state: "gap" as const, seen: { variant: 0, choice: 1 } }]));
const progress = (...parts: Progress["concepts"][]): Progress => ({
  ...emptyProgress(),
  concepts: Object.assign({}, ...parts) as Progress["concepts"],
});

describe("scanSample", () => {
  it("deals up to 4 concepts per topic, unexplored first, keeping topic order", () => {
    const a = topic("a", 6);
    const b = topic("b", 2);
    for (let i = 0; i < 10; i++) {
      const dealt = scanSample([a, b], progress(right("a1"), heard("a2")), Math.random);
      expect(dealt.map((d) => d.group.group.id)).toEqual(["a", "b"]);
      expect(dealt[0].concepts.map((c) => c.id).sort()).toEqual(["a3", "a4", "a5", "a6"]);
      expect(dealt[1].concepts).toHaveLength(2);
    }
  });
});

describe("checkQueue", () => {
  const ids = (q: Concept[]) => q.map((c) => c.id).sort();

  it("gives every topic one check: a Used claim, else a Heard, else its basic question", () => {
    const groups = [topic("a", 4), topic("b", 4), topic("c", 4)];
    const p = progress(used("a3"), heard("b2"), fresh("c2", "c3", "c4"));
    expect(ids(checkQueue(groups, p, "both", Math.random))).toEqual(["a3", "b2", "c1"]);
  });

  it("never re-asks a confirmed concept or a New row", () => {
    const g = topic("g", 3);
    expect(ids(checkQueue([g], progress(right("g1"), fresh("g2", "g3")), "both", Math.random))).toEqual([]);
  });

  it("spends up to 3 extra checks on topics with the most unchecked claims", () => {
    const groups = [topic("a", 6), topic("b", 6), topic("c", 6)];
    const p = progress(used("a2", "a3", "a4", "a5", "a6", "b2", "b3"), fresh("c2"));
    const q = checkQueue(groups, p, "both", Math.random);
    expect(q).toHaveLength(6);
    expect(q.filter((c) => c.id.startsWith("a"))).toHaveLength(3);
    expect(q.filter((c) => c.id.startsWith("b"))).toHaveLength(2);
    expect(ids(q.filter((c) => c.id.startsWith("c")))).toEqual(["c1"]);
  });

  it("caps a run at 12 checks", () => {
    const groups = "abcdefghi".split("").map((g) => topic(g, 5));
    const p = progress(...groups.map((g) => used(...[2, 3, 4, 5].map((i) => `${g.group.id}${i}`))));
    expect(checkQueue(groups, p, "both", Math.random)).toHaveLength(12);
  });

  it("skips concepts with no variant in the chosen language", () => {
    const g = group("g", [{ ...quizzable("go-only", ["go", "go"]), basic: true }, quizzable("any", [null, null])]);
    expect(ids(checkQueue([g], progress(used("go-only", "any")), "ts", Math.random))).toEqual(["any"]);
  });
});

describe("strength", () => {
  it("averages explored concepts: right 1, Used ¾, Heard ½, New and wrong 0", () => {
    const g = topic("g", 6);
    expect(strength(g, progress(right("g1"), used("g2"), heard("g3"), fresh("g4"), wrong("g5")))).toBe(0.45);
    expect(strength(g, emptyProgress())).toBe(0);
  });
});

describe("persona", () => {
  const a = topic("a", 4);
  const b = topic("b", 4);
  const c = topic("c", 4);
  // A finished scan: all 4 rows answered.
  const run = (g: string, ...parts: Progress["concepts"][]) =>
    Object.assign({}, fresh(`${g}1`, `${g}2`, `${g}3`, `${g}4`), ...parts) as Progress["concepts"];

  it("stays locked until every topic is scanned", () => {
    expect(persona([a, b], progress(run("a"), fresh("b1", "b2", "b3")))).toEqual({ kind: "locked" });
  });

  it("unlocks from a scan alone, on self-reports", () => {
    const claimed = (g: string) => run(g, used(`${g}1`, `${g}2`, `${g}3`, `${g}4`));
    expect(persona([a, b], progress(claimed("a"), run("b")))).toEqual({ kind: "group", id: "a" });
  });

  it("is the Apprentice when no topic reaches 60%", () => {
    expect(persona([a, b], progress(run("a", wrong("a1")), run("b", wrong("b1"))))).toEqual({
      kind: "apprentice",
    });
  });

  it("is the Wanderer when every topic reaches 60%", () => {
    const strong = (g: string) => run(g, right(`${g}1`, `${g}2`), used(`${g}3`, `${g}4`));
    expect(persona([a, b], progress(strong("a"), strong("b")))).toEqual({ kind: "wanderer" });
  });

  it("otherwise is the strongest passing topic, ties broken by right answers then topic order", () => {
    const p = progress(
      run("a", right("a1", "a2"), used("a3", "a4")),
      run("b", right("b1", "b2", "b3", "b4")),
      run("c", wrong("c1")),
    );
    expect(persona([a, b, c], p)).toEqual({ kind: "group", id: "b" });
    const tie = progress(
      run("a", right("a1", "a2", "a3", "a4")),
      run("b", right("b1", "b2", "b3", "b4")),
      run("c", wrong("c1")),
    );
    expect(persona([a, b, c], tie)).toEqual({ kind: "group", id: "a" });
  });
});

describe("allChecked", () => {
  it("is true once every quizzable topic has a quiz answer", () => {
    const a = topic("a", 2);
    const b = topic("b", 2);
    const scanOnly = group("s", [{ ...quizzable("s1"), variants: [] }]);
    expect(allChecked([a, b, scanOnly], progress(used("a1", "a2", "b1", "b2")))).toBe(false);
    expect(allChecked([a, b, scanOnly], progress(right("a1"), wrong("b2")))).toBe(true);
  });
});

describe("stats", () => {
  it("counts quiz results and topics overall and per group", () => {
    const a = group("a", [quizzable("a1"), quizzable("a2"), scanOnly("a3")]);
    const b = group("b", [quizzable("b1"), quizzable("b2")]);
    const p: Progress = {
      ...emptyProgress(),
      concepts: {
        a1: { state: "confirmed" },
        a2: { state: "gap", seen: { variant: 0, choice: 1 } },
        a3: { state: "claimed" },
        b1: { state: "gap" },
      },
    };
    expect(stats([a, b], p)).toEqual({
      correct: 1,
      wrong: 1,
      used: 1,
      gaps: 2,
      unexplored: 1,
      groups: [
        { id: "a", title: "A", correct: 1, answered: 2, explored: 3, total: 3 },
        { id: "b", title: "B", correct: 0, answered: 0, explored: 1, total: 2 },
      ],
    });
  });
});

describe("gapText", () => {
  it("lists gaps grouped by group and skill, groups sorted by gap count", () => {
    const a = group("a", [quizzable("a1"), quizzable("a2")]);
    const b = group("b", [quizzable("b1"), quizzable("b2")]);
    const text = gapText([a, b], withStates({ a1: "gap", b1: "gap", b2: "gap", a2: "claimed" }));
    expect(text).toBe(
      ["B", "  Skill S", "  - b1: b1 summary", "  - b2: b2 summary", "", "A", "  Skill S", "  - a1: a1 summary"].join(
        "\n",
      ),
    );
  });
});

describe("report", () => {
  const a = group("a", [quizzable("a1"), quizzable("a2"), quizzable("a3")]);
  const b = group("b", [quizzable("b1"), quizzable("b2"), scanOnly("b3")]);

  it("lists every topic and concept with its status, in content order", () => {
    let p = scan(emptyProgress(), a.skills[0].concepts[0], "used");
    p = scan(p, a.skills[0].concepts[1], "name");
    p = scan(p, b.skills[0].concepts[0], "never");
    p = answer(p, b.skills[0].concepts[1], 0, 0);
    expect(report([a, b], p, "Ant · Porter")).toBe(
      [
        "# Nerdscape report",
        "",
        "Persona: **Ant · Porter** (self-reported; not checked by the quiz yet)",
        "",
        "## A",
        "",
        "### Skill S",
        "",
        "- **a1**: Used",
        "- **a2**: Heard",
        "- **a3**: Not explored",
        "",
        "## B",
        "",
        "### Skill S",
        "",
        "- **b1**: New",
        "- **b2**: Confirmed",
        "- **b3**: Not explored",
        "",
      ].join("\n"),
    );
  });

  it("shows the question, picked choice, answer and explanation for a missed concept", () => {
    const c: Concept = {
      ...quizzable("m"),
      variants: [{ ...v("go"), q: "Line one\n\n```go\nx := 1\n```", choices: ["`a`", "b", "c", "d"] }, v("ts")],
    };
    const p = answer(emptyProgress(), c, 0, 2);
    expect(report([group("m", [c, scanOnly("n")])], p, "Ant · Porter")).toBe(
      [
        "# Nerdscape report",
        "",
        "Persona: **Ant · Porter** (checked by the quiz)",
        "",
        "## M",
        "",
        "### Skill S",
        "",
        "- **m**: Missed",
        "",
        "  Line one",
        "",
        "  ```go",
        "  x := 1",
        "  ```",
        "",
        "  You picked: c",
        "  Answer: `a`",
        "",
        "  e",
        "",
        "- **n**: Not explored",
        "",
      ].join("\n"),
    );
  });

  it("says when there is no persona yet", () => {
    expect(report([a], emptyProgress(), null)).toContain("Persona: not unlocked yet (finish a quick scan or a quiz)");
  });
});

describe("backup", () => {
  it("round-trips", () => {
    const p = answer(emptyProgress(), quizzable("c"), 0, 2);
    expect(parseBackup(JSON.stringify(p))).toEqual(p);
  });

  it("rejects junk and unknown schema versions", () => {
    expect(() => parseBackup("nope")).toThrow();
    expect(() => parseBackup(JSON.stringify({ schemaVersion: 99, concepts: {} }))).toThrow();
    expect(() => parseBackup(JSON.stringify({ schemaVersion: 1, concepts: { x: { state: "bogus" } } }))).toThrow();
  });
});
