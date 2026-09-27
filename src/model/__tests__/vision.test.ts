import { describe, expect, it } from "vitest";
import type { ResolvedItem } from "../resolve";
import type { Drill } from "../types";
import { DEFAULT_BOARD_DISPLAY, sceneWithDisplay, stepWithDisplay } from "../boardDisplay";
import { gazeBearing, SCAN_AMPLITUDE_DEGREES, SCAN_PERIOD_MS, scanOffset, visionBearing } from "../vision";

const player: ResolvedItem = {
  entity: { id: "player-7", kind: "player", team: "home" },
  pose: { x: 8, y: 12 },
  heading: 90,
};

describe("coaching gaze", () => {
  it("uses the explicit bearing instead of travel direction, including zero", () => {
    expect(gazeBearing({ ...player, pose: { ...player.pose, rotation: 0 } })).toBe(0);
    expect(gazeBearing({ ...player, pose: { ...player.pose, rotation: -45 } })).toBe(315);
    expect(gazeBearing(player)).toBe(90);
  });

  it("does not sweep when scanning is disabled", () => {
    expect(visionBearing(player, 0, false)).toBe(90);
    expect(visionBearing(player, 2700, false)).toBe(90);
  });

  it("stays within the limited sweep and repeats at the same timeline time", () => {
    for (let time = 0; time < SCAN_PERIOD_MS; time += 37) {
      const offset = scanOffset(time, player.entity.id);
      expect(Math.abs(offset)).toBeLessThanOrEqual(SCAN_AMPLITUDE_DEGREES);
      expect(scanOffset(time + SCAN_PERIOD_MS, player.entity.id)).toBeCloseTo(offset, 8);
    }
    expect(scanOffset(0, "player-1")).not.toBe(scanOffset(0, "player-7"));
  });

  it("keeps authored gaze during a sideways run and matches edit/export sampling", () => {
    const drill: Drill = {
      schemaVersion: 1, id: "gaze-test", title: "Gaze", pitch: "grid", entities: [player.entity],
      steps: [
        { durationMs: 500, positions: { "player-7": { x: 8, y: 2, rotation: 0 } } },
        { durationMs: 1000, pauseAfterMs: 500, positions: { "player-7": { x: 8, y: 12, rotation: 0 } } },
      ],
    };
    const options = { ...DEFAULT_BOARD_DISPLAY, vision: true, scan: true };
    const running = sceneWithDisplay(drill, 1000, false, options);
    expect(running.items[0].heading).toBeCloseTo(90);
    expect(gazeBearing(running.items[0])).toBe(0);

    const edit = stepWithDisplay(drill, 1, false, options);
    const exported = sceneWithDisplay(drill, edit.timeMs!, false, options);
    expect(edit.timeMs).toBe(1500);
    const expected = visionBearing(exported.items[0], exported.timeMs!, true);
    expect(visionBearing(edit.items[0], edit.timeMs!, true)).toBe(expected);
    sceneWithDisplay(drill, 1900, false, options);
    const scrubbedBack = sceneWithDisplay(drill, 1500, false, options);
    expect(visionBearing(scrubbedBack.items[0], scrubbedBack.timeMs!, true)).toBe(expected);
  });
});
