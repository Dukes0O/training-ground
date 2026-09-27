import { describe, expect, it } from "vitest";
import type { Drill } from "../types";
import { cameraViewportAt, DEFAULT_CAMERA_TRACKING, normalizeCameraTracking } from "../cameraTracking";
import type { CameraBounds, CameraTrackingOptions } from "../cameraTracking";
import { getBoardProjection, playerVisualBounds, projectPoint } from "../boardCamera";
import type { BoardView } from "../boardCamera";
import { getTimeline, sceneAt } from "../resolve";
import { resolvePitch } from "../../pitch/formats";
import { DEFAULT_BOARD_DISPLAY, sceneWithDisplay, stepWithDisplay } from "../boardDisplay";
import { exportDimensions } from "../../export/renderFrames";

function fixture(): Drill {
  return {
    schemaVersion: 1, id: "camera-fixture", title: "Camera fixture", pitch: "11v11",
    entities: [
      { kind: "player", id: "p", team: "home", number: 10 },
      { kind: "ball", id: "b" },
      { kind: "ball", id: "spare" },
      { kind: "cone", id: "c" },
    ],
    steps: [
      { durationMs: 1000, positions: { p: { x: 35, y: 32 }, b: { x: 20, y: 32 }, spare: { x: 95, y: 60 }, c: { x: 50, y: 10 } } },
      { durationMs: 4000, pauseAfterMs: 1000, ease: "linear", positions: { p: { x: 65, y: 32 }, b: { x: 50, y: 32 } } },
    ],
  };
}

const followBall: CameraTrackingOptions = { ...DEFAULT_CAMERA_TRACKING, cameraMode: "ball" };
const followPlayer: CameraTrackingOptions = { ...DEFAULT_CAMERA_TRACKING, cameraMode: "player", cameraTargetId: "p" };
const center = (bounds: CameraBounds) => ({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });

describe("deterministic camera tracking", () => {
  for (const view of ["landscape", "portrait", "angled"] as BoardView[]) {
    it(`${view}: fixed half/third crops preserve world spacing, corner players and export framing`, () => {
      const drill = fixture();
      const original = structuredClone(drill);
      const spec = resolvePitch(drill.pitch);
      const full = getBoardProjection(spec, view);
      for (const cameraMode of ["half-left", "half-right", "third-left", "third-right"] as const) {
        const options = { ...DEFAULT_BOARD_DISPLAY, cameraMode, view };
        expect(normalizeCameraTracking(options).cameraMode).toBe(cameraMode);
        const crop = getBoardProjection(spec, view, options.appearance, options.surroundings, options.playerSize, cameraMode);
        expect(crop.matrix).toEqual(full.matrix);
        const x = cameraMode.endsWith("right") ? spec.length : 0;
        const extent = playerVisualBounds(spec.tokenScale, options.playerSize);
        for (const y of [0, spec.width]) {
          const corner = projectPoint(crop.matrix, { x, y });
          expect(corner.x - extent.left).toBeGreaterThanOrEqual(crop.bounds.x);
          expect(corner.x + extent.right).toBeLessThanOrEqual(crop.bounds.x + crop.bounds.width);
          expect(corner.y - extent.above).toBeGreaterThanOrEqual(crop.bounds.y);
          expect(corner.y + extent.below).toBeLessThanOrEqual(crop.bounds.y + crop.bounds.height);
        }
        const still = stepWithDisplay(drill, 0, false, options).cameraBounds!;
        expect(still).toEqual(crop.bounds);
        expect(sceneWithDisplay(drill, 3300, false, options).cameraBounds).toEqual(still);
        const size = exportDimensions(drill, 1280, options);
        expect(Math.abs(size.height - size.width * still.height / still.width)).toBeLessThanOrEqual(1);
      }
      expect(drill).toEqual(original);
    });
  }

  it("does not halve an existing half-pitch again or crop away its only goal", () => {
    const spec = resolvePitch("half-11v11");
    const full = getBoardProjection(spec);
    expect(getBoardProjection(spec, "landscape", "miniatures", "none", 0.5, "half-right").bounds).toEqual(full.bounds);
    const left = getBoardProjection(spec, "landscape", "miniatures", "none", 0.5, "third-left");
    const right = getBoardProjection(spec, "landscape", "miniatures", "none", 0.5, "third-right");
    expect(left.bounds).toEqual(right.bounds);
    expect(left.bounds.width).toBeCloseTo(full.bounds.width - spec.length / 3);
  });
  it("loads old/malformed preferences safely and bounds zoom", () => {
    for (const value of [null, undefined, [], "ball", 3, { cameraMode: "unknown", cameraTargetId: 23, cameraZoom: Infinity }]) {
      expect(normalizeCameraTracking(value)).toEqual(DEFAULT_CAMERA_TRACKING);
    }
    expect(normalizeCameraTracking({ cameraMode: "player", cameraTargetId: "p", cameraZoom: 99 })).toEqual({ ...followPlayer, cameraZoom: 3 });
    expect(normalizeCameraTracking({ cameraZoom: -1 }).cameraZoom).toBe(1);
  });

  it("defaults to the full pitch regardless of time or remembered zoom", () => {
    const drill = fixture();
    const full = getBoardProjection(resolvePitch(drill.pitch), "landscape", "classic").bounds;
    expect(cameraViewportAt(drill, 3200, { cameraZoom: 3 }, "landscape", "classic")).toEqual(full);
    expect(cameraViewportAt(drill, 0, { ...followBall, cameraZoom: 1 }, "landscape", "classic")).toEqual(full);
  });

  it("follows the declared ball and a chosen player independently", () => {
    const drill = fixture();
    const ball = cameraViewportAt(drill, 3000, followBall, "landscape", "classic");
    const player = cameraViewportAt(drill, 3000, followPlayer, "landscape", "classic");
    const ballPosition = sceneAt(drill, 3000, false).items.find((item) => item.entity.id === "b")!.pose;
    expect(center(ball).x).toBeGreaterThan(ballPosition.x);
    expect(center(ball).x - ballPosition.x).toBeLessThan(2);
    expect(center(player).x - center(ball).x).toBeCloseTo(15);
    expect(cameraViewportAt(drill, 4200, followBall).x).toBeGreaterThan(cameraViewportAt(drill, 2200, followBall).x);
  });

  it("samples curves instead of aiming down a straight line between steps", () => {
    const drill = fixture();
    drill.steps[1].positions.b.via = [{ x: 35, y: 50 }];
    const curve = center(cameraViewportAt(drill, 3000, followBall, "landscape", "classic"));
    expect(curve.y).toBeGreaterThan(45);
  });

  it("keeps a very fast pass visible even at maximum zoom", () => {
    const drill = fixture();
    drill.pitch = { format: "grid", overrides: { length: 20, width: 15 } };
    drill.steps = [
      { durationMs: 1000, positions: { b: { x: 2, y: 7.5 } } },
      { durationMs: 80, pauseAfterMs: 1000, ease: "linear", positions: { b: { x: 18, y: 7.5 } } },
    ];
    const options = { ...followBall, cameraZoom: 3 };
    for (const time of [1000, 1010, 1030, 1050, 1070, 1080]) {
      const frame = cameraViewportAt(drill, time, options, "landscape", "classic");
      const ball = sceneAt(drill, time, false).items.find((item) => item.entity.id === "b")!.pose;
      expect(ball.x).toBeGreaterThan(frame.x);
      expect(ball.x).toBeLessThan(frame.x + frame.width);
      expect(ball.y).toBeGreaterThan(frame.y);
      expect(ball.y).toBeLessThan(frame.y + frame.height);
    }
  });

  it("keeps the followed miniature's head and caption visible during a tight downward move", () => {
    const drill = fixture();
    drill.pitch = { format: "grid", overrides: { length: 10, width: 10 } };
    drill.steps = [
      { durationMs: 1000, positions: { p: { x: 5, y: 2 } } },
      { durationMs: 80, pauseAfterMs: 1000, ease: "linear", positions: { p: { x: 5, y: 8 } } },
    ];
    const options = { ...followPlayer, cameraZoom: 3, playerSize: 1.1 };
    const actor = 0.6 * options.playerSize, caption = actor;
    for (const time of [1000, 1020, 1040, 1080]) {
      const frame = cameraViewportAt(drill, time, options);
      const pose = sceneAt(drill, time, false).items[0].pose;
      expect(pose.y - 4.14 * actor).toBeGreaterThanOrEqual(frame.y);
      expect(pose.y + 0.69 * actor + 1.205 * caption).toBeLessThanOrEqual(frame.y + frame.height);
      expect(pose.x - 4.535 * caption).toBeGreaterThanOrEqual(frame.x);
      expect(pose.x + 4.535 * caption).toBeLessThanOrEqual(frame.x + frame.width);
    }
  });

  it("backs off tight zoom on tiny grids at a constant aspect without clipping the player", () => {
    const drill = fixture();
    drill.pitch = { format: "grid", overrides: { length: 5, width: 5 } };
    drill.steps = [{ durationMs: 1000, positions: { p: { x: 2.5, y: 2.5 } } }];
    const options = { ...followPlayer, cameraZoom: 3, playerSize: 1.1 };
    const spec = resolvePitch(drill.pitch);
    for (const view of ["landscape", "portrait", "angled"] as BoardView[]) {
      const projection = getBoardProjection(spec, view, "miniatures", "none", options.playerSize);
      const frame = cameraViewportAt(drill, 0, options, view);
      const anchor = projectPoint(projection.matrix, { x: 2.5, y: 2.5 });
      const actor = spec.tokenScale * options.playerSize;
      expect(frame.width / frame.height).toBeCloseTo(projection.bounds.width / projection.bounds.height, 10);
      expect(frame.width).toBeGreaterThan(projection.bounds.width / 3);
      expect(anchor.x - 4.535 * actor).toBeGreaterThanOrEqual(frame.x);
      expect(anchor.x + 4.535 * actor).toBeLessThanOrEqual(frame.x + frame.width);
      expect(anchor.y - 4.14 * actor).toBeGreaterThanOrEqual(frame.y);
      expect(anchor.y + 0.69 * actor + 1.205 * actor).toBeLessThanOrEqual(frame.y + frame.height);
      expect(cameraViewportAt(drill, 800, options, view)).toEqual(frame);
    }
  });

  it("is identical after arbitrary scrubs and does not change the drill", () => {
    const drill = fixture();
    const before = structuredClone(drill);
    const sampled = cameraViewportAt(drill, 3456.7, followPlayer, "angled");
    for (const time of [6000, 50, 4500, 1200, 3456.7]) cameraViewportAt(drill, time, followPlayer, "angled");
    expect(cameraViewportAt(drill, 3456.7, followPlayer, "angled")).toEqual(sampled);
    expect(cameraViewportAt(drill, 3456.7, followPlayer, "angled", "miniatures", sceneAt(drill, 3456.7, true))).toEqual(sampled);
    expect(drill).toEqual(before);
  });

  for (const view of ["landscape", "portrait", "angled"] as BoardView[]) {
    it(`${view}: keeps fixed dimensions/aspect and stays within full bounds`, () => {
      const drill = fixture();
      drill.steps[0].positions.p = { x: -3, y: -3 };
      drill.steps[1].positions.p = { x: 103, y: 67 };
      const options = { ...followPlayer, cameraZoom: 2.3 };
      const projection = getBoardProjection(resolvePitch(drill.pitch), view);
      const full = projection.bounds;
      for (const time of [0, 1000, 1500, 3000, 4500, 6000]) {
        const frame = cameraViewportAt(drill, time, options, view);
        expect(frame.width).toBeCloseTo(full.width / options.cameraZoom);
        expect(frame.height).toBeCloseTo(full.height / options.cameraZoom);
        expect(frame.width / frame.height).toBeCloseTo(full.width / full.height, 10);
        expect(frame.x).toBeGreaterThanOrEqual(full.x - 1e-10);
        expect(frame.y).toBeGreaterThanOrEqual(full.y - 1e-10);
        expect(frame.x + frame.width).toBeLessThanOrEqual(full.x + full.width + 1e-10);
        expect(frame.y + frame.height).toBeLessThanOrEqual(full.y + full.height + 1e-10);
      }
      // Tracking occurs after projection, including the portrait quarter turn.
      const middle = cameraViewportAt(drill, 3000, options, view);
      const projected = projectPoint(projection.matrix, sceneAt(drill, 3000, false).items.find((item) => item.entity.id === "p")!.pose);
      expect(projected.x).toBeGreaterThan(middle.x);
      expect(projected.x).toBeLessThan(middle.x + middle.width);
      expect(projected.y).toBeGreaterThan(middle.y);
      expect(projected.y).toBeLessThan(middle.y + middle.height);
    });
  }

  it("uses full-pitch fallback for missing, wrong-kind, and hidden targets", () => {
    const drill = fixture();
    const full = cameraViewportAt(drill, 2000, DEFAULT_CAMERA_TRACKING);
    for (const cameraTargetId of ["", "deleted-player", "c", "b"]) {
      expect(cameraViewportAt(drill, 2000, { ...followPlayer, cameraTargetId })).toEqual(full);
    }
    const hidden = fixture();
    hidden.steps[0].positions.b.hidden = true;
    hidden.steps[1].positions.b.hidden = true;
    expect(cameraViewportAt(hidden, 2000, followBall)).toEqual(full); // Does not switch to spare.
    const noBall = fixture();
    noBall.entities = noBall.entities.filter((entity) => entity.kind !== "ball");
    expect(cameraViewportAt(noBall, 2000, followBall)).toEqual(full);
  });

  it("preserves stadium and player-size bounds in both full and tracked frames", () => {
    const drill = fixture();
    const full = getBoardProjection(resolvePitch(drill.pitch), "angled", "miniatures", "stadium", 1.2).bounds;
    const preferences = { ...followPlayer, surroundings: "stadium" as const, playerSize: 1.2 };
    expect(cameraViewportAt(drill, 3000, { ...preferences, cameraMode: "full" }, "angled")).toEqual(full);
    const tracked = cameraViewportAt(drill, 3000, preferences, "angled");
    expect(tracked.width).toBeCloseTo(full.width / preferences.cameraZoom);
    expect(tracked.height).toBeCloseTo(full.height / preferences.cameraZoom);
    expect(tracked.width / tracked.height).toBeCloseTo(full.width / full.height, 10);
  });

  it("shares the preview/export camera aspect while keeping editing at full pitch", () => {
    const drill = fixture();
    const options = { ...DEFAULT_BOARD_DISPLAY, ...followPlayer, view: "portrait" as const, surroundings: "stadium" as const, playerSize: 0.9 };
    const dimensions = exportDimensions(drill, 1280, options);
    for (const time of [1200, 2600, 4300]) {
      const live = sceneWithDisplay(drill, time, false, options);
      const expected = cameraViewportAt(drill, time, options, options.view, options.appearance);
      expect(live.cameraBounds).toEqual(expected);
      expect(Math.abs(dimensions.height - dimensions.width * expected.height / expected.width)).toBeLessThanOrEqual(1);
    }
    expect(stepWithDisplay(drill, 1, false, options).cameraBounds).toBeUndefined();
  });

  it("cuts cleanly across an instant reset without looking ahead or trailing behind it", () => {
    const drill = fixture();
    drill.steps = [
      { durationMs: 1000, positions: { p: { x: 80, y: 32 } } },
      { durationMs: 500, pauseAfterMs: 1000, ease: "instant", positions: { p: { x: 20, y: 32 } } },
    ];
    const before = cameraViewportAt(drill, 0, followPlayer);
    const after = cameraViewportAt(drill, 2000, followPlayer);
    expect(after.x).toBeLessThan(before.x - 40);
    for (const time of [1300, 1499, 1499.9]) expect(cameraViewportAt(drill, time, followPlayer)).toEqual(before);
    for (const time of [1500, 1500.1, 1700]) expect(cameraViewportAt(drill, time, followPlayer)).toEqual(after);
  });

  it("holds its old framing during a 1ms reset, then cuts to the new location", () => {
    const drill = fixture();
    drill.steps = [
      { durationMs: 1000, positions: { p: { x: 80, y: 32 } } },
      { durationMs: 1, pauseAfterMs: 1000, ease: "linear", positions: { p: { x: 20, y: 32 } } },
    ];
    const before = cameraViewportAt(drill, 0, followPlayer);
    const after = cameraViewportAt(drill, 1500, followPlayer);
    for (const time of [900, 999.9, 1000, 1000.5]) expect(cameraViewportAt(drill, time, followPlayer)).toEqual(before);
    expect(cameraViewportAt(drill, 1001, followPlayer)).toEqual(after);
  });

  it("does not blend hidden and reappearing poses across their arrival boundaries", () => {
    const drill = fixture();
    drill.steps = [
      { durationMs: 1000, positions: { p: { x: 80, y: 32 } } },
      { durationMs: 500, pauseAfterMs: 300, positions: { p: { x: 80, y: 32, hidden: true } } },
      { durationMs: 500, pauseAfterMs: 1000, positions: { p: { x: 20, y: 32 } } },
    ];
    expect(cameraViewportAt(drill, 1499, followPlayer)).toEqual(cameraViewportAt(drill, 0, followPlayer));
    expect(cameraViewportAt(drill, 1600, followPlayer)).toEqual(cameraViewportAt(drill, 1600, DEFAULT_CAMERA_TRACKING));
    expect(cameraViewportAt(drill, 2300, followPlayer)).toEqual(cameraViewportAt(drill, 2600, followPlayer));
  });

  it("clamps malformed or out-of-range time to the timeline endpoints", () => {
    const drill = fixture();
    expect(cameraViewportAt(drill, NaN, followPlayer)).toEqual(cameraViewportAt(drill, 0, followPlayer));
    expect(cameraViewportAt(drill, -400, followPlayer)).toEqual(cameraViewportAt(drill, 0, followPlayer));
    expect(cameraViewportAt(drill, 999999, followPlayer)).toEqual(cameraViewportAt(drill, getTimeline(drill).totalMs, followPlayer));
  });
});
