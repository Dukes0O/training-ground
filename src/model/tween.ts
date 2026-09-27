import type { EaseName, Point, Pose } from "./types";

export const DEFAULT_EASE: EaseName = "easeInOut";

/** Map normalized progress [0,1] through an easing curve. */
export function applyEase(ease: EaseName, p: number): number {
  const t = Math.min(Math.max(p, 0), 1);
  switch (ease) {
    case "linear":
      return t;
    case "easeIn":
      return t * t;
    case "easeOut":
      return 1 - (1 - t) * (1 - t);
    case "easeInOut":
      return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    case "instant":
      return t >= 1 ? 1 : 0;
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolate an angle in degrees along the shortest arc. */
export function lerpAngle(a: number, b: number, t: number): number {
  let delta = (((b - a) % 360) + 540) % 360 - 180;
  return a + delta * t;
}

function catmullRomSegment(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Sample a Catmull-Rom spline through `points` at normalized position t in
 * [0,1]. Segment selection is weighted by chord length so progress feels
 * uniform along the whole path. With two points this is a straight lerp.
 */
export function samplePath(points: Point[], t: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  const clamped = Math.min(Math.max(t, 0), 1);
  if (points.length === 2) {
    return {
      x: lerp(points[0].x, points[1].x, clamped),
      y: lerp(points[0].y, points[1].y, clamped),
    };
  }
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.max(dist(points[i], points[i + 1]), 1e-6);
    lengths.push(d);
    total += d;
  }
  let remaining = clamped * total;
  let seg = 0;
  while (seg < lengths.length - 1 && remaining > lengths[seg]) {
    remaining -= lengths[seg];
    seg++;
  }
  const local = lengths[seg] === 0 ? 0 : remaining / lengths[seg];
  const p0 = points[Math.max(seg - 1, 0)];
  const p1 = points[seg];
  const p2 = points[seg + 1];
  const p3 = points[Math.min(seg + 2, points.length - 1)];
  return catmullRomSegment(p0, p1, p2, p3, local);
}

/**
 * Pose at eased progress `p` moving from `from` to `to`, honoring `to.via`
 * waypoints. Rotation takes the shortest arc.
 */
export function tweenPose(from: Pose, to: Pose, p: number): Pose {
  const points: Point[] = [{ x: from.x, y: from.y }, ...(to.via ?? []), { x: to.x, y: to.y }];
  const pt = samplePath(points, p);
  const out: Pose = { x: pt.x, y: pt.y };
  const fromRot = from.rotation ?? 0;
  const toRot = to.rotation ?? 0;
  if (from.rotation != null || to.rotation != null) out.rotation = lerpAngle(fromRot, toRot, p);
  return out;
}
