import type { Drill, Entity, Pose, TeamId, TeamStyle } from "./types";
import { resolveTeamStyles } from "./types";
import type { PitchSpec } from "../pitch/formats";
import { resolvePitch } from "../pitch/formats";

export interface ResolvedItem {
  entity: Entity;
  pose: Pose;
}

/** Everything the board renderer needs to draw one moment of a drill. */
export interface BoardSnapshot {
  spec: PitchSpec;
  gridOn: boolean;
  teams: Record<TeamId, TeamStyle>;
  items: ResolvedItem[];
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
  zone: 0,
  cone: 1,
  flat: 1,
  minigoal: 1,
  ladder: 1,
  mannequin: 1,
  pole: 1,
  hurdle: 1,
  arrow: 2,
  label: 3,
  player: 4,
  ball: 5,
};

export function snapshotAtStep(drill: Drill, stepIndex: number, gridOn: boolean): BoardSnapshot {
  const poses = posesAtStep(drill, stepIndex);
  const items: ResolvedItem[] = [];
  for (const entity of drill.entities) {
    const pose = poses.get(entity.id);
    if (!pose || pose.hidden) continue;
    items.push({ entity, pose });
  }
  items.sort((a, b) => (KIND_LAYER[a.entity.kind] ?? 1) - (KIND_LAYER[b.entity.kind] ?? 1));
  return {
    spec: resolvePitch(drill.pitch),
    gridOn,
    teams: resolveTeamStyles(drill),
    items,
  };
}
