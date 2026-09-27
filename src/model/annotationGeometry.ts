import type { Annotation, Point } from "./types";

export type AreaBounds = { x: number; y: number; w: number; h: number };

export function pointsBounds(points: Point[]): AreaBounds | undefined {
  if (!points.length) return undefined;
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function zoneBounds(zone: Annotation): AreaBounds | undefined {
  return zone.shape === "polygon" ? pointsBounds(zone.points ?? []) : zone.rect;
}

export function polygonArea(points: Point[]): number {
  return Math.abs(points.reduce((sum, point, i) => {
    const next = points[(i + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const onSegment = (p: Point, q: Point, r: Point) => Math.abs(orientation(p, q, r)) < 1e-8 &&
    r.x >= Math.min(p.x, q.x) - 1e-8 && r.x <= Math.max(p.x, q.x) + 1e-8 &&
    r.y >= Math.min(p.y, q.y) - 1e-8 && r.y <= Math.max(p.y, q.y) + 1e-8;
  return orientation(a, b, c) * orientation(a, b, d) < 0 && orientation(c, d, a) * orientation(c, d, b) < 0 ||
    onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

/** Simple, noncollapsed areas only; concave polygons are welcome. */
export function isValidPolygon(points: Point[]): boolean {
  if (points.length < 3 || points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)) || polygonArea(points) < 0.01) return false;
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    if (Math.hypot(points[i].x - points[next].x, points[i].y - points[next].y) < 0.01) return false;
    for (let j = i + 1; j < points.length; j++) {
      const after = (j + 1) % points.length;
      if (j === next || after === i) continue;
      if (segmentsCross(points[i], points[next], points[j], points[after])) return false;
    }
  }
  return true;
}

export function resizePolygon(points: Point[], target: AreaBounds): Point[] {
  const source = pointsBounds(points);
  if (!source || source.w <= 0 || source.h <= 0) return points;
  return points.map((point) => ({ x: target.x + (point.x - source.x) * target.w / source.w, y: target.y + (point.y - source.y) * target.h / source.h }));
}

/** Distance-weighted straight segments, for angular coaching arrows. */
export function samplePolyline(points: Point[], progress: number): Point {
  if (!points.length) return { x: 0, y: 0 };
  const lengths = points.slice(1).map((p, index) => Math.hypot(p.x - points[index].x, p.y - points[index].y));
  let remaining = Math.min(1, Math.max(0, progress)) * lengths.reduce((sum, length) => sum + length, 0);
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index];
    if (length > 0 && remaining <= length) {
      const amount = remaining / length;
      return { x: points[index].x + (points[index + 1].x - points[index].x) * amount, y: points[index].y + (points[index + 1].y - points[index].y) * amount };
    }
    remaining -= length;
  }
  return points[points.length - 1];
}
