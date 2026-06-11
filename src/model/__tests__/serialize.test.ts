import { describe, expect, it } from "vitest";
import type { Drill } from "../types";
import { serializeDense } from "../serialize";

function fixture(): Drill {
  return {
    schemaVersion: 1,
    id: "test",
    title: "Test",
    description: "",
    pitch: "grid",
    entities: [
      { kind: "player", id: "p1", team: "home" },
      { kind: "ball", id: "ball" },
    ],
    steps: [
      { positions: { p1: { x: 1.111111, y: 2 }, ball: { x: 3, y: 4 }, ghost: { x: 9, y: 9 } } },
      { positions: { p1: { x: 5, y: 6, via: [{ x: 3, y: 9 }], ease: "linear" } } },
      { positions: { ball: { x: 7, y: 8 } } },
    ],
  };
}

describe("serializeDense", () => {
  it("materializes forward-filled poses in every step", () => {
    const out = serializeDense(fixture());
    expect(Object.keys(out.steps[1].positions).sort()).toEqual(["ball", "p1"]);
    expect(out.steps[2].positions.p1).toMatchObject({ x: 5, y: 6 });
  });

  it("keeps via/ease only on the step where they were explicit", () => {
    const out = serializeDense(fixture());
    expect(out.steps[1].positions.p1.via).toEqual([{ x: 3, y: 9 }]);
    expect(out.steps[1].positions.p1.ease).toBe("linear");
    expect(out.steps[2].positions.p1.via).toBeUndefined();
    expect(out.steps[2].positions.p1.ease).toBeUndefined();
  });

  it("drops position keys that match no entity", () => {
    const out = serializeDense(fixture());
    expect(out.steps[0].positions.ghost).toBeUndefined();
  });

  it("rounds coordinates to centimeters and drops empty fields", () => {
    const out = serializeDense(fixture());
    expect(out.steps[0].positions.p1.x).toBe(1.11);
    expect(out.description).toBeUndefined();
    expect(out.$schema).toBe("../schema/drill.schema.json");
  });
});
