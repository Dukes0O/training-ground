import { describe, expect, it } from "vitest";
import type { Drill } from "../types";
import { parseDrill, semanticIssues } from "../schema";

function fixture(): Drill {
  return {
    schemaVersion: 1,
    id: "test",
    title: "Test",
    pitch: { format: "grid", overrides: { length: 20, width: 20 } },
    entities: [
      { kind: "player", id: "p1", team: "home" },
      { kind: "ball", id: "ball" },
    ],
    steps: [
      { positions: { p1: { x: 5, y: 5 }, ball: { x: 6, y: 6 } } },
      { positions: { p1: { x: 10, y: 10, via: [{ x: 7, y: 9 }], ease: "linear" } } },
    ],
  };
}

describe("parseDrill", () => {
  it("keeps the first of duplicate entity ids", () => {
    const raw = fixture();
    raw.entities.push({ kind: "player", id: "p1", team: "away", number: 99 });
    const drill = parseDrill(raw);
    expect(drill.entities.filter((e) => e.id === "p1")).toHaveLength(1);
    expect((drill.entities[0] as { team: string }).team).toBe("home");
  });

  it("materializes sparse steps dense at load", () => {
    const drill = parseDrill(fixture());
    expect(Object.keys(drill.steps[1].positions).sort()).toEqual(["ball", "p1"]);
    // inherited copy carries no transition fields
    expect(drill.steps[1].positions.ball.via).toBeUndefined();
    // explicit pose keeps its transition fields
    expect(drill.steps[1].positions.p1.via).toEqual([{ x: 7, y: 9 }]);
  });

  it("drops position keys for unknown entities", () => {
    const raw = fixture();
    raw.steps[0].positions.ghost = { x: 1, y: 1 };
    const drill = parseDrill(raw);
    expect(drill.steps[0].positions.ghost).toBeUndefined();
  });
});

describe("semanticIssues coordinate guard", () => {
  it("warns on pixel-scale coordinates", () => {
    const drill = fixture();
    drill.steps[0].positions.p1 = { x: 450, y: 230 };
    const issues = semanticIssues(drill);
    expect(issues.some((i) => i.message.includes("meters, not pixels"))).toBe(true);
  });

  it("stays quiet for in-bounds drills (including the apron)", () => {
    const drill = fixture();
    drill.steps[0].positions.p1 = { x: -2.5, y: 22 }; // inside the 3m apron
    expect(semanticIssues(drill)).toHaveLength(0);
  });

  it("warns when fromStep is beyond the last step", () => {
    const drill = fixture();
    drill.entities.push({ kind: "arrow", id: "a1", from: { x: 1, y: 1 }, to: { x: 2, y: 2 }, fromStep: 9 });
    const issues = semanticIssues(drill);
    expect(issues.some((i) => i.message.includes("never be visible"))).toBe(true);
  });

  it("warns about labels that are never placed", () => {
    const drill = fixture();
    drill.entities.push({ kind: "label", id: "l1", text: "hi" });
    const issues = semanticIssues(drill);
    expect(issues.some((i) => i.message.includes('label "l1" never appears'))).toBe(true);
  });
});
