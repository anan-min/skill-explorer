import { describe, expect, it } from "vitest";
import { validateContent } from "./validate.ts";

const variant = (over = {}) => ({
  lang: "go",
  q: "Q?",
  choices: ["a", "b", "c", "d"],
  answer: 1,
  explain: "Because.",
  ...over,
});

const concept = (slug: string, over = {}) => ({
  id: `g/s/${slug}`,
  title: slug,
  summary: "One line",
  level: "medium",
  variants: [variant(), variant({ lang: "ts" })],
  ...over,
});

const file = (concepts: unknown[], name = "01-g.json") => ({
  name,
  data: {
    group: { id: "g", title: "G" },
    skills: [{ id: "s", title: "S", summary: "What S covers", concepts }],
  },
});

describe("validateContent", () => {
  it("accepts a valid file", () => {
    expect(validateContent([file([concept("a", { level: "easy" }), concept("b", { variants: [] })])])).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it("rejects a file that does not match the schema", () => {
    const { errors } = validateContent([{ name: "01-g.json", data: { group: {} } }]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects a single variant", () => {
    const { errors } = validateContent([file([concept("a", { variants: [variant()] })])]);
    expect(errors.join("\n")).toMatch(/0 or at least 2 variants/);
  });

  it("rejects anything but exactly 4 distinct choices", () => {
    expect(
      validateContent([file([concept("a", { variants: [variant({ choices: ["a", "b", "c"] }), variant()] })])]).errors,
    ).not.toEqual([]);
    expect(
      validateContent([
        file([concept("a", { variants: [variant({ choices: ["a", "a", "c", "d"] }), variant()] })]),
      ]).errors.join("\n"),
    ).toMatch(/distinct/);
  });

  it("rejects an out-of-range answer and an empty explain", () => {
    expect(
      validateContent([file([concept("a", { variants: [variant({ answer: 4 }), variant()] })])]).errors,
    ).not.toEqual([]);
    expect(
      validateContent([file([concept("a", { variants: [variant({ explain: "" }), variant()] })])]).errors,
    ).not.toEqual([]);
  });

  it("rejects a concept id that does not match its group and skill", () => {
    const { errors } = validateContent([file([concept("a", { id: "other/s/a" })])]);
    expect(errors.join("\n")).toMatch(/other\/s\/a/);
  });

  it("rejects duplicate concept ids, including across files", () => {
    expect(validateContent([file([concept("a"), concept("a")])]).errors.join("\n")).toMatch(/duplicate/i);
    expect(validateContent([file([concept("a")]), file([concept("a")], "02-g.json")]).errors.join("\n")).toMatch(
      /duplicate/i,
    );
  });

  it("rejects a file name that does not match the group id", () => {
    expect(validateContent([file([concept("a")], "01-wrong.json")]).errors.join("\n")).toMatch(/01-wrong\.json/);
  });

  it("warns, not fails, on more than 8 concepts in a skill", () => {
    const many = Array.from({ length: 9 }, (_, i) => concept(`c${i}`, { level: i === 0 ? "easy" : "medium" }));
    const result = validateContent([file(many)]);
    expect(result.errors).toEqual([]);
    expect(result.warnings.join("\n")).toMatch(/9 concepts/);
  });

  it("rejects a group without a quizzable easy concept", () => {
    expect(validateContent([file([concept("a")])]).errors.join("\n")).toMatch(/easy/);
    // A scan-only concept can't be asked, so it doesn't count as the easy question.
    expect(validateContent([file([concept("a", { level: "easy", variants: [] })])]).errors.join("\n")).toMatch(/easy/);
  });

  it("warns, not fails, on a skill with no quizzable easy concept", () => {
    const data = file([concept("a", { level: "easy" })]).data;
    data.skills.push({ id: "t", title: "T", summary: "What T covers", concepts: [concept("b").valueOf()] });
    (data.skills[1].concepts[0] as { id: string }).id = "g/t/b";
    const result = validateContent([{ name: "01-g.json", data }]);
    expect(result.errors).toEqual([]);
    expect(result.warnings.join("\n")).toMatch(/skill t has no quizzable easy concept/);
  });
});
