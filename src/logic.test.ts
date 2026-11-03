import { describe, expect, it } from "vitest";
import type { Concept, GroupFile, Variant } from "./schema.ts";
import {
  answer,
  emptyProgress,
  gapText,
  parseBackup,
  persona,
  pickVariant,
  quizQueue,
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

describe("quizQueue", () => {
  const a = group("a", [
    quizzable("f1"),
    quizzable("g1"),
    quizzable("c1"),
    quizzable("ok"),
    scanOnly("so"),
    quizzable("f2"),
  ]);
  const b = group("b", [quizzable("b1"), quizzable("b2"), quizzable("b3")]);
  const p = withStates({ g1: "gap", c1: "claimed", ok: "confirmed", b1: "gap", b2: "gap" });

  it("takes 2 per group, claimed first, then fog, then gap; never confirmed or scan-only", () => {
    for (let i = 0; i < 20; i++) {
      const ids = quizQueue([a, b], p, "both", Math.random).map((c) => c.id);
      expect(ids).toHaveLength(4);
      expect(ids).toContain("c1");
      expect(ids.filter((id) => id === "f1" || id === "f2")).toHaveLength(1);
      expect(ids).toContain("b3");
      expect(ids.filter((id) => id === "b1" || id === "b2")).toHaveLength(1);
    }
  });

  it("mixes groups instead of running one group in a row", () => {
    const groups = ["x", "y", "z"].map((g) => group(g, [quizzable(`${g}1`), quizzable(`${g}2`)]));
    const orders = new Set(
      Array.from({ length: 30 }, () =>
        quizQueue(groups, emptyProgress(), "both", Math.random)
          .map((c) => c.id[0])
          .join(""),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("skips concepts with no variant in the chosen language", () => {
    const g = group("g", [quizzable("go-only", ["go", "go"]), quizzable("any", [null, null])]);
    expect(quizQueue([g], emptyProgress(), "ts", first).map((c) => c.id)).toEqual(["any"]);
  });
});

describe("persona", () => {
  const a = group("a", [quizzable("a1"), quizzable("a2"), quizzable("a3")]);
  const b = group("b", [quizzable("b1"), quizzable("b2"), quizzable("b3")]);
  const c = group("c", [quizzable("c1"), quizzable("c2"), quizzable("c3")]);
  const right = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, { state: "confirmed" as const }]));
  const wrong = (...ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, { state: "gap" as const, seen: { variant: 0, choice: 1 } }]));
  const answers = (...parts: Progress["concepts"][]): Progress => ({
    ...emptyProgress(),
    concepts: Object.assign({}, ...parts) as Progress["concepts"],
  });

  it("stays locked until every quizzable group has 2 quiz answers", () => {
    expect(persona([a, b, c], answers(right("a1", "a2", "b1", "b2"), wrong("c1")))).toEqual({ kind: "locked" });
  });

  it("does not wait on a group too small to quiz", () => {
    const tiny = group("tiny", [quizzable("t1"), scanOnly("t2")]);
    expect(persona([a, tiny], answers(right("a1", "a2")))).toEqual({ kind: "wanderer" });
  });

  it("only counts quiz answers, not self-reports", () => {
    expect(persona([a], withStates({ a1: "claimed", a2: "claimed", a3: "claimed" }))).toEqual({ kind: "locked" });
    expect(persona([a], answers(wrong("a1"), right("a2")))).toEqual({ kind: "apprentice" });
  });

  it("is the Apprentice when no group reaches 60%", () => {
    expect(persona([a, b, c], answers(right("a1", "c1"), wrong("a2", "b1", "b2", "c2")))).toEqual({
      kind: "apprentice",
    });
  });

  it("is the Wanderer when every group reaches 60%", () => {
    expect(persona([a, b, c], answers(right("a1", "a2", "b1", "b2", "c1", "c2"), wrong("c3")))).toEqual({
      kind: "wanderer",
    });
  });

  it("otherwise is the strongest passing group", () => {
    expect(persona([a, b, c], answers(right("a1", "b1", "b2", "b3"), wrong("a2", "c1", "c2")))).toEqual({
      kind: "group",
      id: "b",
    });
  });

  it("breaks a tie by correct answers, then by group order", () => {
    expect(persona([a, b, c], answers(right("a1", "a2", "b1", "b2", "b3"), wrong("c1", "c2")))).toEqual({
      kind: "group",
      id: "b",
    });
    expect(persona([a, b, c], answers(right("a1", "a2", "b1", "b2"), wrong("c1", "c2")))).toEqual({
      kind: "group",
      id: "a",
    });
  });
});

describe("strength", () => {
  it("is correct quiz answers over answered, 0 before any answer", () => {
    const g = group("g", [quizzable("g1"), quizzable("g2"), quizzable("g3"), scanOnly("g4")]);
    const p: Progress = {
      ...emptyProgress(),
      concepts: {
        g1: { state: "confirmed" },
        g2: { state: "gap", seen: { variant: 0, choice: 1 } },
        g3: { state: "claimed" },
        g4: { state: "gap" },
      },
    };
    expect(strength(g, p)).toBe(0.5);
    expect(strength(g, emptyProgress())).toBe(0);
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
