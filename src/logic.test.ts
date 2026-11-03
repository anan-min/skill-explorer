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
  stateOf,
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

const group = (id: string, concepts: Concept[], hidden = false): GroupFile => ({
  group: { id, title: id.toUpperCase(), hidden },
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
  const concepts = [
    quizzable("f1"),
    quizzable("g1"),
    quizzable("c1"),
    quizzable("ok"),
    scanOnly("so"),
    quizzable("f2"),
  ];
  const p = withStates({ g1: "gap", c1: "claimed", ok: "confirmed" });

  it("orders claimed, then fog, then gap; never confirmed or scan-only", () => {
    const q = quizQueue(concepts, p, "both", Math.random).map((c) => stateOf(p, c.id));
    expect(q).toEqual(["claimed", "fog", "fog", "gap"]);
  });

  it("caps a session at 10 questions", () => {
    const lots = Array.from({ length: 15 }, (_, i) => quizzable(`c${i}`));
    expect(quizQueue(lots, emptyProgress(), "both", Math.random)).toHaveLength(10);
  });

  it("skips concepts with no variant in the chosen language", () => {
    const q = quizQueue(
      [quizzable("go-only", ["go", "go"]), quizzable("any", [null, null])],
      emptyProgress(),
      "ts",
      first,
    );
    expect(q.map((c) => c.id)).toEqual(["any"]);
  });
});

describe("persona", () => {
  const a = group("a", [quizzable("a1"), quizzable("a2")]);
  const b = group("b", [quizzable("b1"), quizzable("b2")]);
  const c = group("c", [quizzable("c1"), quizzable("c2")]);
  const fe = group("fe", [quizzable("fe1")], true);

  it("stays locked until 2 visible groups are each at least 50% explored", () => {
    expect(persona([a, b, c], withStates({ a1: "gap", a2: "gap" }), false)).toEqual({ kind: "locked" });
    expect(persona([a, b, c], withStates({ a1: "gap", b1: "gap" })).kind).not.toBe("locked");
  });

  it("is the Wanderer when the spread is at most 15 points", () => {
    expect(persona([a, b], withStates({ a1: "gap", b1: "gap" }))).toEqual({ kind: "wanderer" });
  });

  it("otherwise is the top group", () => {
    expect(persona([a, b, c], withStates({ a1: "gap", b1: "gap", b2: "gap" }))).toEqual({ kind: "group", id: "b" });
  });

  it("breaks a lead tie by confirmed count, then by group order", () => {
    expect(persona([a, b, c], withStates({ a1: "gap", a2: "gap", b1: "gap", b2: "confirmed" }))).toEqual({
      kind: "group",
      id: "b",
    });
    expect(persona([a, b, c], withStates({ a1: "gap", a2: "gap", b1: "gap", b2: "gap" }))).toEqual({
      kind: "group",
      id: "a",
    });
  });

  it("ignores hidden groups unless frontend is on", () => {
    const p = withStates({ a1: "gap", b1: "gap", fe1: "gap" });
    expect(persona([a, b, fe], p, false)).toEqual({ kind: "wanderer" });
    expect(persona([a, b, fe], p, true)).toEqual({ kind: "group", id: "fe" });
  });
});

describe("gapText", () => {
  it("lists gaps grouped by group and skill, groups sorted by gap count", () => {
    const a = group("a", [quizzable("a1"), quizzable("a2")]);
    const b = group("b", [quizzable("b1"), quizzable("b2")]);
    const text = gapText([a, b], withStates({ a1: "gap", b1: "gap", b2: "gap", a2: "claimed" }), false);
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
