import { describe, expect, it } from "vitest";
import { applyEase, lerpAngle, samplePath, tweenPose } from "../tween";

describe("applyEase", () => {
  it("hits exact endpoints for every ease", () => {
    for (const ease of ["linear", "easeIn", "easeOut", "easeInOut", "instant"] as const) {
      expect(applyEase(ease, 0)).toBe(0);
      expect(applyEase(ease, 1)).toBe(1);
    }
  });

  it("instant stays at 0 until arrival", () => {
    expect(applyEase("instant", 0.99)).toBe(0);
    expect(applyEase("instant", 1)).toBe(1);
  });

  it("clamps out-of-range progress", () => {
    expect(applyEase("linear", -0.5)).toBe(0);
    expect(applyEase("linear", 1.5)).toBe(1);
  });
});

describe("lerpAngle", () => {
  it("takes the shortest arc across 0", () => {
    expect(lerpAngle(350, 10, 0.5)).toBeCloseTo(360);
    expect(lerpAngle(10, 350, 0.5)).toBeCloseTo(0);
  });

  it("interpolates plain angles", () => {
    expect(lerpAngle(0, 90, 0.5)).toBeCloseTo(45);
  });
});

describe("samplePath", () => {
  it("is exact at the endpoints", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 5, y: 8 },
      { x: 10, y: 0 },
    ];
    expect(samplePath(pts, 0)).toEqual({ x: 0, y: 0 });
    const end = samplePath(pts, 1);
    expect(end.x).toBeCloseTo(10);
    expect(end.y).toBeCloseTo(0);
  });

  it("lerps straight lines with two points", () => {
    const mid = samplePath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 4 },
      ],
      0.5
    );
    expect(mid).toEqual({ x: 5, y: 2 });
  });

  it("passes near the waypoint mid-path", () => {
    const mid = samplePath(
      [
        { x: 0, y: 0 },
        { x: 5, y: 10 },
        { x: 10, y: 0 },
      ],
      0.5
    );
    expect(Math.hypot(mid.x - 5, mid.y - 10)).toBeLessThan(1.5);
  });
});

describe("tweenPose", () => {
  it("honors via waypoints from the target pose", () => {
    const mid = tweenPose({ x: 0, y: 0 }, { x: 10, y: 0, via: [{ x: 5, y: 6 }] }, 0.5);
    expect(mid.y).toBeGreaterThan(3); // bows toward the waypoint
  });

  it("rotates along the shortest arc", () => {
    const mid = tweenPose({ x: 0, y: 0, rotation: 350 }, { x: 0, y: 0, rotation: 10 }, 0.5);
    expect(mid.rotation).toBeCloseTo(360);
  });
});
