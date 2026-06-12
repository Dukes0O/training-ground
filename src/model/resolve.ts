import type { AnchorPoint, Annotation, Drill, Entity, Point, Pose, TeamId, TeamStyle } from "./types";
import {
  DEFAULT_FIRST_HOLD_MS,
  DEFAULT_PAUSE_AFTER_MS,
  DEFAULT_STEP_DURATION_MS,
  resolveTeamStyles,
} from "./types";
import type { PitchSpec } from "../pitch/formats";
import { resolvePitch } from "../pitch/formats";
import { DEFAULT_EASE, applyEase, tweenPose } from "./tween";

export interface ResolvedItem {
  entity: Entity;
  pose: Pose;
}

export interface ResolvedAnnotation {
  entity: Annotation;
  opacity: number;
  /** Endpoints with anchors resolved (and pulled back to token edges). */
  from?: Point;
  to?: Point;
  /** Label position (labels are posed like normal entities). */
  pose?: Pose;
}

/** Everything the board renderer needs to draw one moment of a drill. */
export interface BoardSnapshot {
  spec: PitchSpec;
  gridOn: boolean;
  teams: Record<TeamId, TeamStyle>;
  items: ResolvedItem[];
  annotations: ResolvedAnnotation[];
  /** Step index this moment belongs to (for annotation visibility windows). */
  stepIndex: number;
}

/**
 * Poses at a step, with sparse steps forward-filled: the pose of an entity at
 * step k is the last explicit pose at or before k. Entities with no pose yet
 * are absent (not on the board).
 */
export function posesAtStep(drill: Drill, stepIndex: number): Map<string, Pose> {
  const poses = new Map<string, Pose>();
  const last = Math.min(stepIndex, drill.steps.length - 1);
  for (let k = 0; k <= last; k++) {
    const step = drill.steps[k];
    if (!step) continue;
    for (const [id, pose] of Object.entries(step.positions)) {
      poses.set(id, pose);
    }
  }
  return poses;
}

const KIND_LAYER: Record<string, number> = {
  cone: 1,
  flat: 1,
  minigoal: 1,
  ladder: 1,
  mannequin: 1,
  pole: 1,
  hurdle: 1,
  player: 4,
  ball: 5,
};

const FADE_MS = 150;

function isAnnotation(e: Entity): e is Annotation {
  return e.kind === "arrow" || e.kind === "zone" || e.kind === "label";
}

/** How far an arrow endpoint pulls back from an anchored entity's center. */
function anchorShrink(entity: Entity | undefined, tokenScale: number): number {
  if (!entity) return 0;
  if (entity.kind === "player") return 1.7 * tokenScale;
  if (entity.kind === "ball") return 0.9 * tokenScale;
  return 0.9 * tokenScale;
}

function resolveAnchor(
  anchor: AnchorPoint | undefined,
  poses: Map<string, Pose>
): { point: Point | null; ref: string | null } {
  if (!anchor) return { point: null, ref: null };
  if ("ref" in anchor) {
    const pose = poses.get(anchor.ref);
    return pose && !pose.hidden ? { point: { x: pose.x, y: pose.y }, ref: anchor.ref } : { point: null, ref: anchor.ref };
  }
  return { point: { x: anchor.x, y: anchor.y }, ref: null };
}

function pullBack(p: Point, toward: Point, by: number): Point {
  const d = Math.hypot(toward.x - p.x, toward.y - p.y);
  if (d <= by || d === 0) return p;
  const f = by / d;
  return { x: p.x + (toward.x - p.x) * f, y: p.y + (toward.y - p.y) * f };
}

/**
 * Annotation opacity for a moment. `fade` describes progress into a move
 * segment so step-scoped notation fades in/out instead of popping.
 */
function annotationOpacity(
  a: Annotation,
  stepIndex: number,
  fade: { elapsedMs: number } | null
): number {
  const from = a.fromStep ?? 0;
  const to = a.toStep ?? Number.POSITIVE_INFINITY;
  const visible = from <= stepIndex && stepIndex <= to;
  if (!fade) return visible ? 1 : 0;
  const ramp = Math.min(Math.max(fade.elapsedMs / FADE_MS, 0), 1);
  if (visible) return from === stepIndex ? ramp : 1;
  if (to === stepIndex - 1 && from <= stepIndex - 1) return 1 - ramp; // just expired
  return 0;
}

function resolveAnnotations(
  drill: Drill,
  poses: Map<string, Pose>,
  stepIndex: number,
  fade: { elapsedMs: number } | null,
  tokenScale: number
): ResolvedAnnotation[] {
  const byId = new Map(drill.entities.map((e) => [e.id, e]));
  const out: ResolvedAnnotation[] = [];
  for (const entity of drill.entities) {
    if (!isAnnotation(entity)) continue;
    const opacity = annotationOpacity(entity, stepIndex, fade);
    if (opacity <= 0) continue;
    const resolved: ResolvedAnnotation = { entity, opacity };
    if (entity.kind === "arrow") {
      const a = resolveAnchor(entity.from, poses);
      const b = resolveAnchor(entity.to, poses);
      if (!a.point || !b.point) continue; // an anchored endpoint isn't on the board
      const towardA = entity.via?.[0] ?? b.point;
      const towardB = entity.via?.[entity.via.length - 1] ?? a.point;
      resolved.from = a.ref ? pullBack(a.point, towardA, anchorShrink(byId.get(a.ref), tokenScale)) : a.point;
      resolved.to = b.ref ? pullBack(b.point, towardB, anchorShrink(byId.get(b.ref), tokenScale)) : b.point;
    } else if (entity.kind === "label") {
      const pose = poses.get(entity.id);
      if (!pose || pose.hidden) continue;
      resolved.pose = pose;
    }
    out.push(resolved);
  }
  return out;
}

function buildSnapshot(
  drill: Drill,
  poses: Map<string, Pose>,
  gridOn: boolean,
  stepIndex: number,
  fade: { elapsedMs: number } | null = null
): BoardSnapshot {
  const items: ResolvedItem[] = [];
  for (const entity of drill.entities) {
    if (isAnnotation(entity)) continue;
    const pose = poses.get(entity.id);
    if (!pose || pose.hidden) continue;
    items.push({ entity, pose });
  }
  items.sort((a, b) => (KIND_LAYER[a.entity.kind] ?? 1) - (KIND_LAYER[b.entity.kind] ?? 1));
  const spec = resolvePitch(drill.pitch);
  return {
    spec,
    gridOn,
    teams: resolveTeamStyles(drill),
    items,
    annotations: resolveAnnotations(drill, poses, stepIndex, fade, spec.tokenScale),
    stepIndex,
  };
}

export function snapshotAtStep(drill: Drill, stepIndex: number, gridOn: boolean): BoardSnapshot {
  return buildSnapshot(drill, posesAtStep(drill, stepIndex), gridOn, stepIndex);
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export interface Segment {
  kind: "hold" | "move" | "pause";
  /** The step whose pose this segment arrives at / holds. */
  stepIndex: number;
  startMs: number;
  endMs: number;
}

export interface CompiledTimeline {
  segments: Segment[];
  totalMs: number;
  /** Arrival time of each step's pose (start of its hold/pause). */
  stepArrivalMs: number[];
}

export function compileTimeline(drill: Drill): CompiledTimeline {
  const segments: Segment[] = [];
  const stepArrivalMs: number[] = [];
  let t = 0;
  drill.steps.forEach((step, k) => {
    if (k === 0) {
      stepArrivalMs.push(0);
      const hold = step.durationMs ?? DEFAULT_FIRST_HOLD_MS;
      if (hold > 0) {
        segments.push({ kind: "hold", stepIndex: 0, startMs: t, endMs: t + hold });
        t += hold;
      }
      return;
    }
    const move = step.durationMs ?? DEFAULT_STEP_DURATION_MS;
    segments.push({ kind: "move", stepIndex: k, startMs: t, endMs: t + move });
    t += move;
    stepArrivalMs.push(t);
    const pause = step.pauseAfterMs ?? DEFAULT_PAUSE_AFTER_MS;
    if (pause > 0) {
      segments.push({ kind: "pause", stepIndex: k, startMs: t, endMs: t + pause });
      t += pause;
    }
  });
  if (segments.length === 0) {
    segments.push({ kind: "hold", stepIndex: 0, startMs: 0, endMs: DEFAULT_FIRST_HOLD_MS });
    t = DEFAULT_FIRST_HOLD_MS;
  }
  return { segments, totalMs: t, stepArrivalMs };
}

const timelineCache = new WeakMap<Drill, CompiledTimeline>();

export function getTimeline(drill: Drill): CompiledTimeline {
  let tl = timelineCache.get(drill);
  if (!tl) {
    tl = compileTimeline(drill);
    timelineCache.set(drill, tl);
  }
  return tl;
}

/** Step index the playhead is in/arriving at, for a given time. */
export function stepAtTime(tl: CompiledTimeline, timeMs: number): number {
  const t = Math.min(Math.max(timeMs, 0), tl.totalMs);
  for (const s of tl.segments) {
    if (t < s.endMs) return s.stepIndex;
    // A move's exact end is the arrival at its step — without this, a step
    // with pauseAfterMs 0 hands the boundary instant to the NEXT move and
    // step jumps/highlights land one step ahead.
    if (t === s.endMs && s.kind === "move") return s.stepIndex;
  }
  return tl.segments[tl.segments.length - 1].stepIndex;
}

/** The board at an arbitrary playback time, tweening through move segments. */
export function sceneAt(drill: Drill, timeMs: number, gridOn: boolean): BoardSnapshot {
  const tl = getTimeline(drill);
  const t = Math.min(Math.max(timeMs, 0), tl.totalMs);
  let seg = tl.segments[tl.segments.length - 1];
  for (const s of tl.segments) {
    if (t < s.endMs || s === tl.segments[tl.segments.length - 1]) {
      seg = s;
      break;
    }
  }
  if (seg.kind !== "move") {
    return buildSnapshot(drill, posesAtStep(drill, seg.stepIndex), gridOn, seg.stepIndex);
  }

  const step = drill.steps[seg.stepIndex];
  const before = posesAtStep(drill, seg.stepIndex - 1);
  const span = seg.endMs - seg.startMs;
  const progress = span === 0 ? 1 : (t - seg.startMs) / span;
  const fade = { elapsedMs: t - seg.startMs };

  const poses = new Map<string, Pose>();
  for (const entity of drill.entities) {
    const from = before.get(entity.id);
    const target = step.positions[entity.id];
    if (target && from) {
      if (target.hidden) {
        // Disappears on arrival; keep visible at the start pose until then.
        if (progress < 1) poses.set(entity.id, from);
        continue;
      }
      if (from.hidden) {
        // Reappears on arrival.
        if (progress >= 1) poses.set(entity.id, target);
        continue;
      }
      const eased = applyEase(target.ease ?? step.ease ?? DEFAULT_EASE, progress);
      poses.set(entity.id, tweenPose(from, target, eased));
    } else if (from) {
      poses.set(entity.id, from); // not moving this step
    } else if (target && progress >= 1) {
      poses.set(entity.id, target); // first appearance: pops in at arrival
    }
  }
  return buildSnapshot(drill, poses, gridOn, seg.stepIndex, fade);
}
