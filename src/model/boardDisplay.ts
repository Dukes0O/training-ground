import type { Drill, Point, Pose, TeamId } from "./types";
import type { BoardSnapshot, CompiledTimeline, ResolvedItem, Segment } from "./resolve";
import { getTimeline, posesAtStep, sceneAt, snapshotAtStep } from "./resolve";
import { applyEase, DEFAULT_EASE, tweenPose } from "./tween";
import type { BoardView, PitchStyle } from "./boardCamera";
import { DEFAULT_PLAYER_SIZE, normalizePlayerSize, resolvePlayerDisplay } from "./playerDisplay";
import type { DisplayScope, PlayerDisplayOverrides } from "./playerDisplay";
import { cameraViewportAt, DEFAULT_CAMERA_TRACKING, fixedPitchFraming } from "./cameraTracking";
import type { CameraTrackingOptions } from "./cameraTracking";

/** Presentation preferences live in the browser, never in a drill file. */
export interface BoardDisplayOptions extends CameraTrackingOptions {
  playerTrails: boolean;
  ballTrail: boolean;
  appearance: "miniatures" | "classic";
  vision: boolean;
  scan: boolean;
  view: BoardView;
  pitchStyle: PitchStyle;
  surroundings: "none" | "stadium";
  stadiumLabel: string;
  stadiumAccent: string;
  playerSize: number;
  playerLabels: "number-role" | "number" | "hidden";
  appearanceScope: DisplayScope;
  trailScope: DisplayScope;
  visionScope: DisplayScope;
  scanScope: DisplayScope;
  drillPlayers: Record<string, Record<string, PlayerDisplayOverrides>>;
}

export const DEFAULT_BOARD_DISPLAY: BoardDisplayOptions = {
  playerTrails: false,
  ballTrail: false,
  appearance: "miniatures",
  vision: false,
  scan: false,
  view: "landscape",
  pitchStyle: "grass",
  surroundings: "none",
  stadiumLabel: "TRAINING GROUND",
  stadiumAccent: "#406a84",
  playerSize: DEFAULT_PLAYER_SIZE,
  playerLabels: "number",
  appearanceScope: "all",
  trailScope: "all",
  visionScope: "all",
  scanScope: "all",
  drillPlayers: {},
  ...DEFAULT_CAMERA_TRACKING,
};

export const TRAIL_WINDOW_MS = 2000;
const SAMPLE_INTERVAL_MS = 80;
const INSTANT_MOVE_MS = 1;

export interface MotionTrailSegment {
  from: Point;
  to: Point;
  /** Already faded according to the age of this part of the trail. */
  opacity: number;
}

export interface MotionTrail {
  id: string;
  kind: "player" | "ball";
  team?: TeamId;
  segments: MotionTrailSegment[];
}

interface DisplayPlan {
  timeline: CompiledTimeline;
  poses: Map<string, Pose>[];
  /** Never connect history across a reset, appearance or disappearance. */
  breaks: Map<string, number[]>;
}

const plans = new WeakMap<Drill, DisplayPlan>();

function getPlan(drill: Drill): DisplayPlan {
  const cached = plans.get(drill);
  if (cached) return cached;
  const timeline = getTimeline(drill);
  const poses = drill.steps.map((_, index) => posesAtStep(drill, index));
  const breaks = new Map<string, number[]>();
  for (const segment of timeline.segments) {
    if (segment.kind !== "move") continue;
    const step = drill.steps[segment.stepIndex];
    for (const [id, target] of Object.entries(step.positions)) {
      const from = poses[segment.stepIndex - 1]?.get(id);
      const instant = segment.endMs - segment.startMs <= INSTANT_MOVE_MS ||
        (target.ease ?? step.ease ?? DEFAULT_EASE) === "instant";
      if (!instant && from && Boolean(from.hidden) === Boolean(target.hidden)) continue;
      const times = breaks.get(id) ?? [];
      if (instant) times.push(segment.startMs);
      times.push(segment.endMs);
      breaks.set(id, times);
    }
  }
  const plan = { timeline, poses, breaks };
  plans.set(drill, plan);
  return plan;
}

function boundedTime(plan: DisplayPlan, timeMs: number): number {
  return Math.min(Math.max(Number.isFinite(timeMs) ? timeMs : 0, 0), plan.timeline.totalMs);
}

function segmentAt(plan: DisplayPlan, timeMs: number): Segment {
  return plan.timeline.segments.find((segment) => timeMs < segment.endMs) ?? plan.timeline.segments.at(-1)!;
}

function lastBreak(plan: DisplayPlan, id: string, timeMs: number): number {
  const times = plan.breaks.get(id) ?? [];
  for (let index = times.length - 1; index >= 0; index--) {
    if (times[index] <= timeMs) return times[index];
  }
  return 0;
}

/** Pure time sampling: scrubbing backwards and an offline export produce the same tails. */
export function sampleMotionTrails(
  drill: Drill,
  timeMs: number,
  options: Pick<BoardDisplayOptions, "playerTrails" | "ballTrail"> & Partial<BoardDisplayOptions>,
  currentSnapshot?: BoardSnapshot,
): MotionTrail[] {
  if (!options.playerTrails && !options.ballTrail) return [];
  const plan = getPlan(drill);
  const now = boundedTime(plan, timeMs);
  const start = Math.max(0, now - TRAIL_WINDOW_MS);
  const current = currentSnapshot ?? sceneAt(drill, now, false);
  const active = segmentAt(plan, now);
  const candidates = current.items.filter(({ entity }) => {
    // A sub-frame reset is not a journey, even if its author omitted instant easing.
    if (active.kind === "move" && active.endMs - active.startMs <= INSTANT_MOVE_MS && drill.steps[active.stepIndex].positions[entity.id]) return false;
    return entity.kind === "player" ? resolvePlayerDisplay(options, drill.id, entity.id).trail : entity.kind === "ball" && options.ballTrail;
  });
  if (!candidates.length || now <= start) return [];

  // Fixed absolute time grid plus exact step boundaries preserve bends/pauses,
  // even when an export has a different frame rate from the live board.
  const sampleTimes = new Set([start, now]);
  for (let time = Math.ceil(start / SAMPLE_INTERVAL_MS) * SAMPLE_INTERVAL_MS; time < now; time += SAMPLE_INTERVAL_MS) sampleTimes.add(time);
  for (const segment of plan.timeline.segments) {
    if (segment.startMs > start && segment.startMs < now) sampleTimes.add(segment.startMs);
    if (segment.endMs > start && segment.endMs < now) sampleTimes.add(segment.endMs);
  }
  const samples = [...sampleTimes].sort((a, b) => a - b).map((time) => ({
    time,
    // Sample through the existing resolver, including curves, easing, sparse
    // poses and hidden entities. Never infer motion from previous frames.
    items: new Map((time === now ? current : sceneAt(drill, time, false)).items.map((item) => [item.entity.id, item.pose])),
  }));

  const trails: MotionTrail[] = [];
  for (const { entity } of candidates) {
    if (entity.kind !== "player" && entity.kind !== "ball") continue;
    const cutoff = Math.max(start, lastBreak(plan, entity.id, now));
    const segments: MotionTrailSegment[] = [];
    let previous: { point: Pose; time: number } | undefined;
    for (const sample of samples) {
      if (sample.time < cutoff) continue;
      const point = sample.items.get(entity.id);
      if (!point) {
        previous = undefined;
        segments.length = 0;
        continue;
      }
      if (previous && Math.hypot(point.x - previous.point.x, point.y - previous.point.y) > 0.002) {
        const age = (now - (previous.time + sample.time) / 2) / TRAIL_WINDOW_MS;
        const opacity = Math.pow(Math.max(0, 1 - age), 1.5) * (entity.kind === "ball" ? 0.58 : 0.38);
        if (opacity > 0.005) segments.push({ from: { x: previous.point.x, y: previous.point.y }, to: { x: point.x, y: point.y }, opacity });
      }
      previous = { point, time: sample.time };
    }
    if (segments.length) trails.push({ id: entity.id, kind: entity.kind, ...(entity.kind === "player" ? { team: entity.team } : {}), segments });
  }
  return trails;
}

function gaitOffset(id: string): number {
  let value = 0;
  for (const character of id) value = (value * 31 + character.charCodeAt(0)) % 997;
  return value / 997;
}

function withMovement(item: ResolvedItem, drill: Drill, timeMs: number, plan: DisplayPlan): ResolvedItem {
  if (item.entity.kind !== "player" && item.entity.kind !== "ball") return item;
  const active = segmentAt(plan, timeMs);
  const cutoff = lastBreak(plan, item.entity.id, timeMs);
  let heading = item.pose.rotation ?? 0;
  let moving = false;
  for (let index = plan.timeline.segments.indexOf(active); index >= 0; index--) {
    const segment = plan.timeline.segments[index];
    if (segment.endMs < cutoff) break;
    if (segment.kind !== "move") continue;
    const step = drill.steps[segment.stepIndex];
    const from = plan.poses[segment.stepIndex - 1]?.get(item.entity.id);
    const to = step.positions[item.entity.id];
    if (!from || !to || from.hidden || to.hidden) continue;
    const ease = to.ease ?? step.ease ?? DEFAULT_EASE;
    const span = segment.endMs - segment.startMs;
    if (span <= INSTANT_MOVE_MS || ease === "instant") break;
    const progress = segment === active ? Math.min(1, Math.max(0, (timeMs - segment.startMs) / span)) : 1;
    const radius = Math.min(0.02, 20 / span);
    const before = tweenPose(from, to, applyEase(ease, Math.max(0, progress - radius)));
    const after = tweenPose(from, to, applyEase(ease, Math.min(1, progress + radius)));
    const distance = Math.hypot(after.x - before.x, after.y - before.y);
    if (distance < 0.00001) continue;
    // Rotation is degrees with +x = 0, +y = 90. Keep the last travel heading
    // while paused, unless the authored pose specifies a facing direction.
    if (segment === active || item.pose.rotation == null) heading = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI;
    moving = segment === active && progress < 1;
    break;
  }
  return { ...item, heading, moving, gaitPhase: moving ? ((timeMs / 640 + gaitOffset(item.entity.id)) % 1) : 0 };
}

function displaySnapshot(snapshot: BoardSnapshot, drill: Drill, timeMs: number, options: BoardDisplayOptions): BoardSnapshot {
  const plan = getPlan(drill);
  const time = boundedTime(plan, timeMs);
  return {
    ...snapshot,
    appearance: options.appearance,
    timeMs: time,
    vision: options.vision,
    scan: options.scan,
    view: options.view,
    pitchStyle: options.pitchStyle,
    surroundings: options.surroundings,
    stadiumLabel: options.stadiumLabel,
    stadiumAccent: options.stadiumAccent,
    playerSize: normalizePlayerSize(options.playerSize),
    playerLabels: options.playerLabels,
    cameraBounds: cameraViewportAt(drill, time, options, options.view, options.appearance, snapshot),
    items: snapshot.items.map((item) => ({
      ...withMovement(item, drill, time, plan),
      ...(item.entity.kind === "player" ? { playerDisplay: resolvePlayerDisplay(options, drill.id, item.entity.id) } : {}),
    })),
    trails: sampleMotionTrails(drill, time, options, snapshot),
  };
}

export function sceneWithDisplay(drill: Drill, timeMs: number, gridOn: boolean, options: BoardDisplayOptions = DEFAULT_BOARD_DISPLAY): BoardSnapshot {
  const time = boundedTime(getPlan(drill), timeMs);
  return displaySnapshot(sceneAt(drill, time, gridOn), drill, time, options);
}

export function stepWithDisplay(drill: Drill, stepIndex: number, gridOn: boolean, options: BoardDisplayOptions = DEFAULT_BOARD_DISPLAY): BoardSnapshot {
  const index = Math.min(Math.max(stepIndex, 0), drill.steps.length - 1);
  const time = getTimeline(drill).stepArrivalMs[index] ?? 0;
  const snapshot = displaySnapshot(snapshotAtStep(drill, index, gridOn), drill, time, options);
  // A selected edit step is a still pose, even when the next move has no pause.
  return { ...snapshot, cameraBounds: fixedPitchFraming(options.cameraMode) === "full" ? undefined : snapshot.cameraBounds, items: snapshot.items.map((item) => ({ ...item, moving: false, gaitPhase: 0 })) };
}
