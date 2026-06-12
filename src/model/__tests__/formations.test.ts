import { describe, expect, it } from "vitest";
import { FORMATIONS, buildFormationSlots, matchRosterToSlots } from "../formations";
import { PITCH_FORMATS } from "../../pitch/formats";

const spec9 = PITCH_FORMATS["9v9"];

describe("buildFormationSlots", () => {
  it("places GK plus the right number of outfielders", () => {
    for (const f of FORMATIONS["9v9"]!) {
      const slots = buildFormationSlots(spec9, f, "left");
      expect(slots).toHaveLength(1 + f.lines.reduce((a, b) => a + b, 0));
      expect(slots[0].position).toBe("GK");
      expect(slots[0].number).toBe(1);
    }
  });

  it("numbers sequentially through the lines", () => {
    const slots = buildFormationSlots(spec9, FORMATIONS["9v9"]![0], "left");
    expect(slots.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("keeps a left-defending team in the left half", () => {
    const slots = buildFormationSlots(spec9, FORMATIONS["9v9"]![0], "left");
    for (const s of slots) {
      expect(s.x).toBeLessThan(spec9.length / 2);
      expect(s.x).toBeGreaterThan(0);
      expect(s.y).toBeGreaterThan(0);
      expect(s.y).toBeLessThan(spec9.width);
    }
  });

  it("mirrors a right-defending team exactly", () => {
    const left = buildFormationSlots(spec9, FORMATIONS["9v9"]![1], "left");
    const right = buildFormationSlots(spec9, FORMATIONS["9v9"]![1], "right");
    for (let i = 0; i < left.length; i++) {
      expect(right[i].x).toBeCloseTo(spec9.length - left[i].x);
      expect(right[i].y).toBeCloseTo(spec9.width - left[i].y);
      expect(right[i].position).toBe(left[i].position);
    }
  });

  it("uses sensible labels for a back four", () => {
    const slots = buildFormationSlots(PITCH_FORMATS["11v11"], FORMATIONS["11v11"]![0], "left");
    expect(slots.slice(1, 5).map((s) => s.position)).toEqual(["LB", "LCB", "RCB", "RB"]);
  });
});

describe("matchRosterToSlots", () => {
  const slots = buildFormationSlots(spec9, FORMATIONS["9v9"]![0], "left"); // GK,LB,CB,RB,LM,CM,RM,LS,RS

  it("prefers exact position matches, fills the rest in order", () => {
    const roster = [
      { id: "a", name: "Avery", position: "CM" },
      { id: "b", name: "Ben", position: "GK" },
      { id: "c", name: "Cam" },
      { id: "d", name: "Dre", position: "ST" }, // no ST slot in 3-3-2 -> ordered fill
    ];
    const match = matchRosterToSlots(slots, roster);
    expect(match[0]?.name).toBe("Ben"); // GK slot
    expect(match[slots.findIndex((s) => s.position === "CM")]?.name).toBe("Avery");
    const placedNames = match.filter(Boolean).map((p) => p!.name);
    expect(placedNames).toContain("Cam");
    expect(placedNames).toContain("Dre");
  });

  it("leaves slots empty when the roster is short", () => {
    const match = matchRosterToSlots(slots, [{ id: "a", name: "Only" }]);
    expect(match.filter(Boolean)).toHaveLength(1);
  });

  it("skips unnamed roster rows", () => {
    const match = matchRosterToSlots(slots, [{ id: "a", name: "" }]);
    expect(match.filter(Boolean)).toHaveLength(0);
  });
});
