import { describe, expect, it } from "vitest";
import { DEX, dexKey } from "./mascots.ts";

describe("mascot dex", () => {
  it("lists every animal in every job, then Fox and Chick, once each", () => {
    expect(DEX).toHaveLength(83);
    expect(new Set(DEX.map((e) => e.key)).size).toBe(83);
    expect(DEX.at(-2)?.key).toBe("wanderer");
    expect(DEX.at(-1)?.key).toBe("apprentice");
  });

  it("keys a persona the way the dex lists it", () => {
    expect(dexKey({ kind: "group", id: "frontend", job: "testing" })).toBe("frontend--testing");
    expect(dexKey({ kind: "wanderer" })).toBe("wanderer");
    expect(dexKey({ kind: "locked" })).toBeNull();
    const keys = new Set(DEX.map((e) => e.key));
    expect(keys.has(dexKey({ kind: "group", id: "backend", job: "backend" })!)).toBe(true);
  });
});
