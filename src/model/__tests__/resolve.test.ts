import { describe, expect, it } from "vitest";
import type { Drill } from "../types";
import { compileTimeline, posesAtStep, sceneAt, stepAtTime } from "../resolve";

function fixture(): Drill {
  return {
    schemaVersion: 1,
    id: "test",
    title: "Test",
    pitch: "9v9",
    entities: [
      { kind: "player", id: "p1", team: "home", number: 7 },
      { kind: "player", id: "late", team: "away", number: 9 },
      { kind: "ball", id: "ball" },
    ],
    steps: [
      // hold 800 (default)
      { positions: { p1: { x: 0, y: 0 }, ball: { x: 10, y: 10 } } },
      // move 1000 + pause 0
      {
        durationMs: 1000,
        pauseAfterMs: 0,
        positions: { p1: { x: 10, y: 0, ease: "linear" }, late: { x: 30, y: 30 } },
      },
      // move 2000 (default) + pause 500
      { pauseAfterMs: 500, positions: { ball: { x: 20, y: 10, ease: "linear" } } },
    ],
  };
}

describe("compileTimeline", () => {
  it("builds hold/move/pause segments with defaults", () => {
    const tl = compileTimeline(fixture());
    expect(tl.segments.map((s) => s.kind)).toEqual(["hold", "move", "move", "pause"]);
    expect(tl.totalMs).toBe(800 + 1000 + 2000 + 500);
    expect(tl.stepArrivalMs).toEqual([0, 1800, 3800]);
  });
});

describe("posesAtStep", () => {
  it("forward-fills sparse steps", () => {
    const drill = fixture();
    const at2 = posesAtStep(drill, 2);
    expect(at2.get("p1")).toMatchObject({ x: 10, y: 0 }); // from step 1
    expect(at2.get("ball")).toMatchObject({ x: 20, y: 10 });
  });

  it("omits entities not yet introduced", () => {
    const drill = fixture();
    expect(posesAtStep(drill, 0).has("late")).toBe(false);
    expect(posesAtStep(drill, 1).has("late")).toBe(true);
  });
});

describe("stepAtTime", () => {
  it("maps times to the arriving step", () => {
    const tl = compileTimeline(fixture());
    expect(stepAtTime(tl, 0)).toBe(0);
    expect(stepAtTime(tl, 900)).toBe(1);
    expect(stepAtTime(tl, 2000)).toBe(2);
    expect(stepAtTime(tl, 99999)).toBe(2);
  });

  it("gives a zero-pause move's end instant to the arriving step", () => {
    // fixture step 1 has pauseAfterMs: 0 and its move ends at 1800.
    const tl = compileTimeline(fixture());
    expect(stepAtTime(tl, 1800)).toBe(1);
    expect(stepAtTime(tl, 1801)).toBe(2);
  });
});

describe("sceneAt", () => {
  const find = (drill: Drill, t: number, id: string) =>
    sceneAt(drill, t, false).items.find((i) => i.entity.id === id);

  it("holds the setup pose during the initial hold", () => {
    const drill = fixture();
    expect(find(drill, 400, "p1")?.pose).toMatchObject({ x: 0, y: 0 });
  });

  it("tweens linearly to the midpoint of a move", () => {
    const drill = fixture();
    // Move 1 runs 800..1800; midpoint at 1300.
    const pose = find(drill, 1300, "p1")?.pose;
    expect(pose?.x).toBeCloseTo(5, 1);
    expect(pose?.y).toBeCloseTo(0, 5);
  });

  it("keeps non-movers parked during a move", () => {
    const drill = fixture();
    expect(find(drill, 1300, "ball")?.pose).toMatchObject({ x: 10, y: 10 });
  });

  it("hides late entities until they arrive", () => {
    const drill = fixture();
    expect(find(drill, 1300, "late")).toBeUndefined();
    expect(find(drill, 1900, "late")?.pose).toMatchObject({ x: 30, y: 30 });
  });

  it("holds the final pose through the trailing pause and beyond", () => {
    const drill = fixture();
    expect(find(drill, 4000, "ball")?.pose).toMatchObject({ x: 20, y: 10 });
    expect(find(drill, 4300, "ball")?.pose).toMatchObject({ x: 20, y: 10 });
  });

  it("snaps instant-eased movers at arrival only", () => {
    const drill = fixture();
    drill.steps[1].positions.p1 = { x: 10, y: 0, ease: "instant" };
    expect(find(drill, 1790, "p1")?.pose).toMatchObject({ x: 0, y: 0 });
    expect(find(drill, 1801, "p1")?.pose).toMatchObject({ x: 10, y: 0 });
  });
});
