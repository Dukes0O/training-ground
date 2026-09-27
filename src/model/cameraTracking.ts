import type { Drill, Point, Pose } from "./types";
import type { BoardSnapshot } from "./resolve";
import { getTimeline, posesAtStep, sceneAt } from "./resolve";
import { getBoardProjection, playerVisualBounds, projectPoint } from "./boardCamera";
import type { BoardView, PitchFraming, StadiumSurroundings } from "./boardCamera";
import { resolvePitch } from "../pitch/formats";
import { DEFAULT_EASE } from "./tween";

export interface CameraTrackingOptions {
  cameraMode: PitchFraming | "ball" | "player";
  cameraTargetId: string;
  cameraZoom: number;
}

export interface CameraBounds { x: number; y: number; width: number; height: number }

/** Projection options are supplied by display state, not camera persistence. */
export type CameraTrackingPreferences = Partial<CameraTrackingOptions> & {
  surroundings?: StadiumSurroundings;
  playerSize?: number;
};

export const DEFAULT_CAMERA_TRACKING: CameraTrackingOptions = {
  cameraMode: "full", cameraTargetId: "", cameraZoom: 2,
};
export const MIN_CAMERA_ZOOM = 1;
export const MAX_CAMERA_ZOOM = 3;

export function fixedPitchFraming(mode: unknown): PitchFraming {
  return mode === "half-left" || mode === "half-right" || mode === "third-left" || mode === "third-right" ? mode : "full";
}

/** Old browser preferences and stale target IDs must remain safe to load. */
export function normalizeCameraTracking(value: unknown): CameraTrackingOptions {
  const saved = value && typeof value === "object" ? value as Partial<CameraTrackingOptions> : {};
  return {
    cameraMode: saved.cameraMode === "ball" || saved.cameraMode === "player" ? saved.cameraMode : fixedPitchFraming(saved.cameraMode),
    cameraTargetId: typeof saved.cameraTargetId === "string" ? saved.cameraTargetId : "",
    cameraZoom: typeof saved.cameraZoom === "number" && Number.isFinite(saved.cameraZoom)
      ? Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM, saved.cameraZoom))
      : DEFAULT_CAMERA_TRACKING.cameraZoom,
  };
}

interface TargetContinuity {
  breaks: number[];
  resets: { startMs: number; endMs: number; before?: Pose }[];
}

const continuityCache = new WeakMap<Drill, Map<string, TargetContinuity>>();

function targetContinuity(drill: Drill, id: string): TargetContinuity {
  let targets = continuityCache.get(drill);
  if (!targets) { targets = new Map(); continuityCache.set(drill, targets); }
  const cached = targets.get(id);
  if (cached) return cached;
  const breaks = new Set<number>();
  const resets: TargetContinuity["resets"] = [];
  for (const segment of getTimeline(drill).segments) {
    if (segment.kind !== "move") continue;
    const step = drill.steps[segment.stepIndex];
    const target = step.positions[id];
    if (!target) continue;
    const before = posesAtStep(drill, segment.stepIndex - 1).get(id);
    const instant = (target.ease ?? step.ease ?? DEFAULT_EASE) === "instant";
    const reset = segment.endMs - segment.startMs <= 1;
    if (instant || reset || !before || Boolean(before.hidden) !== Boolean(target.hidden)) breaks.add(segment.endMs);
    if (reset) {
      breaks.add(segment.startMs);
      resets.push({ startMs: segment.startMs, endMs: segment.endMs, before });
    }
  }
  const result = { breaks: [...breaks].sort((a, b) => a - b), resets };
  targets.set(id, result);
  return result;
}

const CAMERA_SAMPLES = [
  { offsetMs: -160, weight: 1 },
  { offsetMs: 0, weight: 4 },
  { offsetMs: 160, weight: 2 },
  { offsetMs: 320, weight: 1 },
];

function targetAt(snapshot: BoardSnapshot, id: string): Point | undefined {
  const pose = snapshot.items.find((item) => item.entity.id === id)?.pose;
  return pose && !pose.hidden && Number.isFinite(pose.x) && Number.isFinite(pose.y) ? pose : undefined;
}

/**
 * Deterministic framing in projected SVG units. A short weighted timeline window
 * softens direction changes and gently looks ahead; it never reads a prior frame.
 * Full-pitch fallback and every tracked frame retain the same output aspect ratio.
 */
export function cameraViewportAt(
  drill: Drill,
  timeMs: number,
  preferences: CameraTrackingPreferences,
  view: BoardView = "landscape",
  appearance: "miniatures" | "classic" = "miniatures",
  currentSnapshot?: BoardSnapshot,
): CameraBounds {
  const options = normalizeCameraTracking(preferences);
  const projection = getBoardProjection(currentSnapshot?.spec ?? resolvePitch(drill.pitch), view, appearance, preferences.surroundings, preferences.playerSize, fixedPitchFraming(options.cameraMode));
  const full = projection.bounds;
  if ((options.cameraMode !== "ball" && options.cameraMode !== "player") || options.cameraZoom === 1) return { ...full };
  // Use the first declared ball consistently, rather than jumping between balls
  // as one appears/disappears. A missing or hidden target uses the full pitch.
  const target = options.cameraMode === "ball"
    ? drill.entities.find((entity) => entity.kind === "ball")
    : drill.entities.find((entity) => entity.kind === "player" && entity.id === options.cameraTargetId);
  if (!target) return { ...full };
  const timeline = getTimeline(drill);
  const time = Math.max(0, Math.min(timeline.totalMs, Number.isFinite(timeMs) ? timeMs : 0));
  const current = currentSnapshot ?? sceneAt(drill, time, false);
  const position = targetAt(current, target.id);
  if (!position) return { ...full };

  const continuity = targetContinuity(drill, target.id);
  let lower = 0;
  let upper = timeline.totalMs;
  for (const boundary of continuity.breaks) {
    if (boundary <= time) lower = boundary;
    // Stay on this side of an arrival that teleports, hides or reveals a target.
    else { upper = Math.max(time, boundary - 0.001); break; }
  }
  const reset = continuity.resets.find((segment) => time >= segment.startMs && time < segment.endMs);
  let center: Point;
  if (reset?.before && !reset.before.hidden) {
    // A 1ms reset may interpolate in the resolver, but is not a camera journey.
    center = projectPoint(projection.matrix, reset.before);
  } else {
    let x = 0;
    let y = 0;
    let weight = 0;
    for (const sample of CAMERA_SAMPLES) {
      const sampleTime = Math.max(lower, Math.min(upper, time + sample.offsetMs));
      const point = sampleTime === time ? position : targetAt(sceneAt(drill, sampleTime, false), target.id);
      if (!point) continue;
      const projected = projectPoint(projection.matrix, point);
      x += projected.x * sample.weight;
      y += projected.y * sample.weight;
      weight += sample.weight;
    }
    center = weight ? { x: x / weight, y: y / weight } : projectPoint(projection.matrix, position);
  }
  const tokenScale = current.spec.tokenScale;
  const extent = target.kind === "player"
    ? playerVisualBounds(tokenScale, preferences.playerSize, appearance)
    : { left: 1.05 * tokenScale, right: 1.05 * tokenScale, above: 1.05 * tokenScale, below: 1.05 * tokenScale };
  const padding = 0.15 * tokenScale;
  // On a tiny grid, back off the requested zoom just enough to contain the
  // complete target. This cap depends on geometry, never on playback history.
  const zoom = Math.max(1, Math.min(options.cameraZoom,
    full.width / (extent.left + extent.right + 2 * padding),
    full.height / (extent.above + extent.below + 2 * padding)));
  const width = full.width / zoom;
  const height = full.height / zoom;
  // A quick pass on a small grid can travel most of the viewport inside the
  // look-ahead window. Keep its current position in the central 60% of the crop.
  const targetPoint = projectPoint(projection.matrix, reset?.before && !reset.before.hidden ? reset.before : position);
  center.x = Math.max(targetPoint.x - width * 0.2, Math.min(targetPoint.x + width * 0.2, center.x));
  center.y = Math.max(targetPoint.y - height * 0.2, Math.min(targetPoint.y + height * 0.2, center.y));
  // Miniatures rise above their footpoint and captions extend below it. Frame
  // those asymmetric bounds, not just the position being followed.
  center.x = Math.max(targetPoint.x + extent.right + padding - width / 2,
    Math.min(targetPoint.x - extent.left - padding + width / 2, center.x));
  center.y = Math.max(targetPoint.y + extent.below + padding - height / 2,
    Math.min(targetPoint.y - extent.above - padding + height / 2, center.y));
  return {
    x: Math.max(full.x, Math.min(full.x + full.width - width, center.x - width / 2)),
    y: Math.max(full.y, Math.min(full.y + full.height - height, center.y - height / 2)),
    width, height,
  };
}
