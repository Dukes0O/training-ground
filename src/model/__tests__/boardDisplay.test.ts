import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BoardSvg } from "../../board/BoardSvg";
import kickoffLeft from "../../../drills/preview-kickoff-left.json?raw";
import kickoffRight from "../../../drills/preview-kickoff-right.json?raw";
import { DEFAULT_BOARD_DISPLAY, sampleMotionTrails, sceneWithDisplay, stepWithDisplay, TRAIL_WINDOW_MS } from "../boardDisplay";
import { getTimeline, sceneAt } from "../resolve";
import { parseDrill } from "../schema";
import type { Drill } from "../types";

const both = { ...DEFAULT_BOARD_DISPLAY, playerTrails: true, ballTrail: true };

function fixture(): Drill {
  return {
    schemaVersion: 1, id: "trail-fixture", title: "Trail fixture", pitch: "9v9",
    entities: [
      { kind: "player", id: "p", team: "home" },
      { kind: "ball", id: "b" },
      { kind: "cone", id: "c" },
    ],
    steps: [
      { durationMs: 1000, positions: { p: { x: 0, y: 10 }, b: { x: 10, y: 12 }, c: { x: 0, y: 0 } } },
      { durationMs: 4000, pauseAfterMs: 0, ease: "linear", positions: { p: { x: 40, y: 10 }, b: { x: 50, y: 12 }, c: { x: 40, y: 0 } } },
      { durationMs: 3000, pauseAfterMs: 0, positions: {} },
    ],
  };
}

describe("deterministic board display", () => {
  it("clips the rendered world to the camera frame, including letterboxed views", () => {
    const snapshot = stepWithDisplay(fixture(), 0, false, { ...DEFAULT_BOARD_DISPLAY, cameraMode: "third-right", view: "angled" });
    const bounds = snapshot.cameraBounds!;
    const markup = renderToStaticMarkup(createElement(BoardSvg, { snapshot }));
    expect(markup).toContain(`viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}"`);
    expect(markup).toContain('clipPathUnits="userSpaceOnUse"');
    expect(markup).toMatch(/<g clip-path="url\(#[^)]+\)"><g data-board-world="true"/);
    expect(markup).toContain(`<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}"></rect></clipPath>`);
  });
  it("defaults to miniatures with overlays off, without changing resolved positions", () => {
    const drill = fixture();
    const before = structuredClone(drill);
    const displayed = sceneWithDisplay(drill, 2300, false);
    expect(displayed.appearance).toBe("miniatures");
    expect(displayed.trails).toEqual([]);
    expect(displayed.vision).toBe(false);
    expect(displayed.scan).toBe(false);
    expect(displayed.items.map((item) => item.pose)).toEqual(sceneAt(drill, 2300, false).items.map((item) => item.pose));
    expect(drill).toEqual(before);
  });

  it("filters player and ball trails independently and never trails equipment", () => {
    const drill = fixture();
    expect(sampleMotionTrails(drill, 3000, { playerTrails: true, ballTrail: false }).map((trail) => trail.id)).toEqual(["p"]);
    expect(sampleMotionTrails(drill, 3000, { playerTrails: false, ballTrail: true }).map((trail) => trail.id)).toEqual(["b"]);
    expect(sampleMotionTrails(drill, 3000, both).map((trail) => trail.id)).toEqual(["p", "b"]);
  });

  it("bounds history to two seconds and increases opacity toward the moving head", () => {
    const player = sampleMotionTrails(fixture(), 4000, both)[0];
    expect(TRAIL_WINDOW_MS).toBe(2000);
    expect(player.segments.length).toBeGreaterThan(10);
    expect(player.segments.length).toBeLessThanOrEqual(27);
    expect(player.segments[0].from.x).toBeGreaterThanOrEqual(10);
    expect(player.segments.at(-1)?.to.x).toBeCloseTo(30);
    for (let i = 1; i < player.segments.length; i++) expect(player.segments[i].opacity).toBeGreaterThan(player.segments[i - 1].opacity);
  });

  it("does not depend on playback direction or earlier renders", () => {
    const drill = fixture();
    const first = sceneWithDisplay(drill, 3876.5, false, both);
    sceneWithDisplay(drill, 7100, false, both);
    sceneWithDisplay(drill, 1200, false, both);
    expect(sceneWithDisplay(drill, 3876.5, false, both)).toEqual(first);
  });

  it("fades a stopped player's history until it disappears, without a stationary mark", () => {
    const drill = fixture();
    const justStopped = sampleMotionTrails(drill, 5000, both)[0];
    const later = sampleMotionTrails(drill, 6100, both)[0];
    expect(later.segments.at(-1)!.opacity).toBeLessThan(justStopped.segments.at(-1)!.opacity);
    expect(sampleMotionTrails(drill, 7100, both)).toEqual([]);
    expect(sampleMotionTrails(drill, 500, both)).toEqual([]);
  });

  it("samples curves and actual tangents rather than connecting only step endpoints", () => {
    const drill = fixture();
    drill.steps[1].positions.p = { x: 40, y: 10, via: [{ x: 20, y: 30 }] };
    const trail = sampleMotionTrails(drill, 4000, both)[0];
    expect(trail.segments.some((segment) => segment.to.y > 25)).toBe(true);
    const display = sceneWithDisplay(drill, 2000, false, both);
    const player = display.items.find((item) => item.entity.id === "p")!;
    expect(player.moving).toBe(true);
    expect(player.heading).toBeGreaterThan(20);
    expect(player.gaitPhase).toBeGreaterThanOrEqual(0);
    expect(player.gaitPhase).toBeLessThan(1);
  });

  it("never draws a jump during or after a 1ms reset, even with linear easing", () => {
    const drill = fixture();
    drill.steps = [
      { durationMs: 1000, positions: { p: { x: 0, y: 10 } } },
      { durationMs: 1000, pauseAfterMs: 0, ease: "linear", positions: { p: { x: 60, y: 10 } } },
      { durationMs: 1, pauseAfterMs: 0, ease: "linear", positions: { p: { x: 0, y: 10 } } },
      { durationMs: 1000, pauseAfterMs: 0, ease: "linear", positions: { p: { x: 8, y: 10 } } },
    ];
    for (const time of [2000, 2000.5, 2001]) expect(sampleMotionTrails(drill, time, both)).toEqual([]);
    const player = sampleMotionTrails(drill, 2301, both)[0];
    expect(player.segments.length).toBeGreaterThan(0);
    for (const segment of player.segments) {
      expect(segment.from.x).toBeGreaterThanOrEqual(0);
      expect(segment.to.x).toBeLessThanOrEqual(2.4);
    }
  });

  it("respects instant easing and hidden/reappearing entities", () => {
    const drill = fixture();
    drill.steps = [
      { durationMs: 1000, positions: { p: { x: 0, y: 10 } } },
      { durationMs: 1000, pauseAfterMs: 0, ease: "linear", positions: { p: { x: 10, y: 10 } } },
      { durationMs: 500, pauseAfterMs: 0, ease: "instant", positions: { p: { x: 60, y: 10 } } },
      { durationMs: 500, pauseAfterMs: 0, positions: { p: { x: 60, y: 10, hidden: true } } },
      { durationMs: 500, pauseAfterMs: 0, positions: { p: { x: 5, y: 10, hidden: false } } },
      { durationMs: 1000, pauseAfterMs: 0, ease: "linear", positions: { p: { x: 10, y: 10 } } },
    ];
    expect(sampleMotionTrails(drill, 2500, both)).toEqual([]);
    expect(sampleMotionTrails(drill, 3250, both)).toEqual([]);
    const trail = sampleMotionTrails(drill, 3700, both)[0];
    expect(trail.segments.every((segment) => segment.from.x >= 5 && segment.to.x <= 6)).toBe(true);
  });

  it("keeps selected steps still and retains the exact timeline time for exports/scanning", () => {
    const drill = fixture();
    const options = { ...both, appearance: "classic" as const, vision: true, scan: true };
    const display = stepWithDisplay(drill, 1, false, options);
    expect(display.timeMs).toBe(getTimeline(drill).stepArrivalMs[1]);
    expect(display.appearance).toBe("classic");
    expect(display.vision).toBe(true);
    expect(display.scan).toBe(true);
    expect(display.items.every((item) => !item.moving && item.gaitPhase === 0)).toBe(true);
    expect(display.trails).toEqual(sceneWithDisplay(drill, display.timeMs!, false, options).trails);
  });

  for (const [id, raw] of [["preview-kickoff-left", kickoffLeft], ["preview-kickoff-right", kickoffRight]]) {
    it(`clears trails across the real ${id} replay reset`, () => {
      const drill = parseDrill(JSON.parse(raw));
      const timeline = getTimeline(drill);
      const reset = timeline.segments.find((segment) => segment.kind === "move" && segment.endMs - segment.startMs === 1)!;
      expect(reset).toBeDefined();
      expect(sampleMotionTrails(drill, reset.startMs + 0.5, both)).toEqual([]);
      expect(sampleMotionTrails(drill, reset.endMs, both)).toEqual([]);
      expect(sampleMotionTrails(drill, reset.endMs + 1000, both)).toEqual([]);
    });
  }
});
