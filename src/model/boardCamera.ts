import { APRON } from "../pitch/formats";
import type { PitchSpec } from "../pitch/formats";
import type { Point } from "./types";
import { normalizePlayerSize } from "./playerDisplay";

export type BoardView = "landscape" | "portrait" | "angled";
export type PitchStyle = "grass" | "stadium" | "light" | "dark";
export type StadiumSurroundings = "none" | "stadium";
export const STADIUM_MARGIN = 9;
export const PLAYER_CAPTION_MAX_WIDTH = 9;
export interface AffineMatrix { a: number; b: number; c: number; d: number; e: number; f: number }

export interface PlayerVisualBounds { left: number; right: number; above: number; below: number }

/** Conservative visible extents around an upright player's feet, in SVG units. */
export function playerVisualBounds(tokenScale: number, playerSize = 0.7, appearance: "miniatures" | "classic" = "miniatures"): PlayerVisualBounds {
  const size = normalizePlayerSize(playerSize);
  const actor = tokenScale * size;
  const caption = tokenScale * Math.max(size, 0.85);
  // Includes selected outlines and bounded captions with their strokes. A
  // miniature board can mix in simple players through scopes/overrides, so its
  // envelope also contains the lower simple-player caption.
  const halfWidth = Math.max(1.9 * actor, (PLAYER_CAPTION_MAX_WIDTH / 2 + 0.1) * caption);
  const simpleBelow = Math.max(1.75 * actor, 2.15 * actor + 0.6 * caption);
  return {
    left: halfWidth, right: halfWidth,
    above: appearance === "miniatures" ? 4.3 * actor : 1.75 * actor,
    below: appearance === "miniatures" ? Math.max(0.69 * actor + 1.27 * caption, simpleBelow) : simpleBelow,
  };
}

export interface BoardProjection {
  matrix: AffineMatrix;
  inverse: AffineMatrix;
  bounds: { x: number; y: number; width: number; height: number };
  transform: string;
  inverseLinear: string;
}

function matrixText(matrix: AffineMatrix): string {
  return `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`;
}

export function projectPoint(matrix: AffineMatrix, point: Point): Point {
  return { x: matrix.a * point.x + matrix.c * point.y + matrix.e, y: matrix.b * point.x + matrix.d * point.y + matrix.f };
}

export function invertMatrix(matrix: AffineMatrix): AffineMatrix {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (Math.abs(determinant) < 1e-10) throw new Error("Board projection must be invertible.");
  return {
    a: matrix.d / determinant, b: -matrix.b / determinant,
    c: -matrix.c / determinant, d: matrix.a / determinant,
    e: (matrix.c * matrix.f - matrix.d * matrix.e) / determinant,
    f: (matrix.b * matrix.e - matrix.a * matrix.f) / determinant,
  };
}

/** An affine coaching-board view. World positions always remain in metres. */
export function getBoardProjection(spec: PitchSpec, view: BoardView = "landscape", appearance: "miniatures" | "classic" = "miniatures", surroundings: StadiumSurroundings = "none", playerSize = 0.7): BoardProjection {
  const matrix: AffineMatrix = view === "portrait"
    ? { a: 0, b: 1, c: -1, d: 0, e: spec.width, f: 0 }
    : view === "angled"
      ? { a: 1, b: -0.12, c: 0.34, d: 0.62, e: 0, f: 0 }
      : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const inverse = invertMatrix(matrix);
  const margin = surroundings === "stadium" ? STADIUM_MARGIN : APRON;
  const corners = [
    { x: -margin, y: -margin }, { x: spec.length + margin, y: -margin },
    { x: -margin, y: spec.width + margin }, { x: spec.length + margin, y: spec.width + margin },
  ].map((point) => projectPoint(matrix, point));
  const minX = Math.min(...corners.map((point) => point.x));
  const maxX = Math.max(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxY = Math.max(...corners.map((point) => point.y));
  // Upright figures extend above their ground position. Include that space in
  // the shared viewport so actors near the apron also fit in exports.
  const actor = playerVisualBounds(spec.tokenScale, playerSize, appearance);
  return {
    matrix, inverse,
    bounds: { x: minX - actor.left, y: minY - actor.above, width: maxX - minX + actor.left + actor.right, height: maxY - minY + actor.above + actor.below },
    transform: matrixText(matrix),
    inverseLinear: matrixText({ ...inverse, e: 0, f: 0 }),
  };
}

/** Cancel the camera at an actor's footpoint without moving that point. */
export function billboardTransform(projection: BoardProjection, point: Point): string {
  return `translate(${point.x} ${point.y}) ${projection.inverseLinear} translate(${-point.x} ${-point.y})`;
}

/** Keep upright labels readable when a camera places their anchor near an edge. */
export function billboardLabelOffset(projection: BoardProjection, point: Point, width: number, height: number, padding: number): Point {
  const anchor = projectPoint(projection.matrix, point);
  const { bounds } = projection;
  const halfW = Math.min(width / 2 + padding, bounds.width / 2);
  const halfH = Math.min(height / 2 + padding, bounds.height / 2);
  return {
    x: Math.max(bounds.x + halfW, Math.min(bounds.x + bounds.width - halfW, anchor.x)) - anchor.x,
    y: Math.max(bounds.y + halfH, Math.min(bounds.y + bounds.height - halfH, anchor.y)) - anchor.y,
  };
}

export function projectedHeading(projection: BoardProjection, degrees: number): number {
  const angle = degrees * Math.PI / 180;
  const { a, b, c, d } = projection.matrix;
  return Math.atan2(b * Math.cos(angle) + d * Math.sin(angle), a * Math.cos(angle) + c * Math.sin(angle)) * 180 / Math.PI;
}

/** Export frames and PNGs share the SVG's exact projected aspect ratio. */
export function boardExportDimensions(spec: PitchSpec, widthPx: number, view: BoardView = "landscape", appearance: "miniatures" | "classic" = "miniatures", surroundings: StadiumSurroundings = "none", playerSize = 0.7): { width: number; height: number } {
  const { bounds } = getBoardProjection(spec, view, appearance, surroundings, playerSize);
  const width = Math.max(2, Math.round(widthPx / 2) * 2);
  return { width, height: Math.max(2, Math.round((width * bounds.height) / bounds.width / 2) * 2) };
}

export interface PitchPalette {
  apron: string; stripeA: string; stripeB: string; line: string; grid: string;
  goalFill: string; goalNet: string; ink: string; playerTrail: string; ballTrail: string;
}

export const PITCH_PALETTES: Record<PitchStyle, PitchPalette> = {
  grass: { apron: "#3e7d50", stripeA: "#4c9a63", stripeB: "#469059", line: "#fafafa", grid: "#ffffff40", goalFill: "#ffffff38", goalNet: "#ffffff8c", ink: "#ffffff", playerTrail: "#edf8ef", ballTrail: "#fff6cf" },
  stadium: { apron: "#123b2c", stripeA: "#236046", stripeB: "#1b503b", line: "#e8efda", grid: "#e8efda2e", goalFill: "#e8efda22", goalNet: "#e8efda70", ink: "#eff8e4", playerTrail: "#e8f9ec", ballTrail: "#fff2b6" },
  light: { apron: "#e7eae4", stripeA: "#fafbf7", stripeB: "#f5f7f2", line: "#728477", grid: "#71847730", goalFill: "#71847712", goalNet: "#71847775", ink: "#304b3b", playerTrail: "#587064", ballTrail: "#916512" },
  dark: { apron: "#171e23", stripeA: "#29343b", stripeB: "#263137", line: "#9caeb5", grid: "#bacbd52a", goalFill: "#bacbd514", goalNet: "#bacbd570", ink: "#eaf2f4", playerTrail: "#d1e8e9", ballTrail: "#f5eaba" },
};
