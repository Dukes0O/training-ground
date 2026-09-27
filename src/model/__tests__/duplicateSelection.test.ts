import { describe, expect, it } from "vitest";
import { duplicateSelection } from "../duplicateSelection";
import { semanticIssues } from "../schema";
import type { Annotation, Drill } from "../types";

function fixture(): Drill {
  return {
    schemaVersion: 1, id: "copies", title: "Copies", pitch: { format: "grid", overrides: { length: 20, width: 20 } },
    entities: [
      { kind: "player", id: "p1", team: "home" }, { kind: "player", id: "p2", team: "away" }, { kind: "ball", id: "ball" },
      { kind: "arrow", id: "route", style: "pass", pathMode: "straight", from: { ref: "p1" }, to: { ref: "p2" }, via: [{ x: 8, y: 4 }], fromStep: 1, toStep: 2 },
      { kind: "arrow", id: "external", from: { ref: "p1" }, to: { ref: "ball" } },
      { kind: "zone", id: "area", shape: "polygon", points: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 3, y: 5 }] },
    ],
    steps: [
      { positions: { p1: { x: 4, y: 5, rotation: 0 }, ball: { x: 5, y: 5 } } },
      { positions: { p1: { x: 12, y: 5, via: [{ x: 8, y: 3 }], ease: "linear" }, p2: { x: 12, y: 12 } } },
      { positions: { p2: { x: 14, y: 12, hidden: true } } },
    ],
  };
}

describe("duplicate selection", () => {
  it("copies complete sparse choreography, hidden poses, internal links and polygon geometry", () => {
    const original = fixture();
    const before = structuredClone(original);
    const { drill, ids, idMap } = duplicateSelection(original, ["p1", "p2", "route", "external", "area"]);
    expect(idMap.p1).toBe("p1-copy");
    expect(ids).toEqual(["p1-copy", "p2-copy", "route-copy", "external-copy", "area-copy"]);
    expect(drill.steps[0].positions["p2-copy"]).toBeUndefined();
    expect(drill.steps[2].positions["p1-copy"]).toBeUndefined();
    expect(drill.steps[0].positions["p1-copy"]).toEqual({ x: 6, y: 7, rotation: 0 });
    expect(drill.steps[1].positions["p1-copy"].via).toEqual([{ x: 10, y: 5 }]);
    expect(drill.steps[2].positions["p2-copy"]).toEqual({ x: 16, y: 14, hidden: true });
    const route = drill.entities.find((entity) => entity.id === "route-copy") as Annotation;
    expect(route.from).toEqual({ ref: "p1-copy" });
    expect(route.to).toEqual({ ref: "p2-copy" });
    expect(route.fromStep).toBe(1);
    expect(route.via).toEqual([{ x: 10, y: 6 }]);
    expect((drill.entities.find((entity) => entity.id === "external-copy") as Annotation).to).toEqual({ ref: "ball" });
    expect((drill.entities.find((entity) => entity.id === "area-copy") as Annotation).points?.[0]).toEqual({ x: 3, y: 3 });
    expect(original).toEqual(before);
    expect(semanticIssues(drill)).toEqual([]);
  });

  it("moves boundary copies inward as a group and assigns fresh ids on repeated duplication", () => {
    const original = fixture();
    original.steps[1].positions.p1 = { x: 22, y: 22 };
    original.steps[1].positions.p2 = { x: 20, y: 20 };
    const first = duplicateSelection(original, ["p1", "p2"]);
    expect(first.drill.steps[1].positions["p1-copy"]).toEqual({ x: 20, y: 20 });
    expect(first.drill.steps[1].positions["p2-copy"]).toEqual({ x: 18, y: 18 });
    expect(semanticIssues(first.drill)).toEqual([]);
    expect(duplicateSelection(first.drill, ["p1"]).ids).toEqual(["p1-copy-2"]);
  });
});
