import type { Drill, Pose, Step } from "./types";

const round = (v: number) => Math.round(v * 100) / 100;

function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function inheritedCopy(p: Pose): Pose {
  // via/ease describe the transition INTO the step where the pose was written
  // explicitly — forward-filled copies must not repeat them.
  const out: Pose = { x: p.x, y: p.y };
  if (p.rotation != null) out.rotation = p.rotation;
  if (p.hidden) out.hidden = true;
  return out;
}

/**
 * Materialize forward-fill: every step lists every entity placed so far, with
 * via/ease kept only on the step where they were explicit. Used both when
 * saving (serializeDense) and when loading (parseDrill), so editing semantics
 * don't depend on whether a file arrived sparse or dense.
 */
export function densifySteps(drill: Drill): Step[] {
  const ids = new Set(drill.entities.map((e) => e.id));
  const running = new Map<string, Pose>();
  return drill.steps.map((step) => {
    const explicit = new Set<string>();
    for (const [id, pose] of Object.entries(step.positions)) {
      if (!ids.has(id)) continue;
      running.set(id, pose);
      explicit.add(id);
    }
    const positions: Record<string, Pose> = {};
    for (const e of drill.entities) {
      const p = running.get(e.id);
      if (p) positions[e.id] = explicit.has(e.id) ? { ...p } : inheritedCopy(p);
    }
    return { ...step, positions };
  });
}

function cleanPose(p: Pose): Pose {
  const out: Pose = { x: round(p.x), y: round(p.y) };
  if (p.rotation != null) out.rotation = round(p.rotation);
  if (p.hidden) out.hidden = true;
  if (p.via && p.via.length > 0) out.via = p.via.map((pt) => ({ x: round(pt.x), y: round(pt.y) }));
  if (p.ease) out.ease = p.ease;
  return out;
}

/**
 * Wire/file form of a drill: forward-fill materialized, coordinates rounded
 * to centimeters, undefined keys dropped. Sparse files stay legal on load;
 * the app saves dense so each step reads independently. rev/createdAt/
 * updatedAt are stamped by the server.
 */
export function serializeDense(drill: Drill): Drill {
  const steps: Step[] = densifySteps(drill).map((step) => {
    const positions: Record<string, Pose> = {};
    for (const [id, p] of Object.entries(step.positions)) positions[id] = cleanPose(p);
    return compact({
      name: step.name,
      durationMs: step.durationMs,
      pauseAfterMs: step.pauseAfterMs,
      ease: step.ease,
      positions,
    });
  });
  return compact({
    $schema: "../schema/drill.schema.json",
    schemaVersion: 1 as const,
    id: drill.id,
    title: drill.title,
    description: drill.description || undefined,
    tags: drill.tags && drill.tags.length > 0 ? drill.tags : undefined,
    notes: drill.notes || undefined,
    themeColor: drill.themeColor,
    pitch: drill.pitch,
    teams: drill.teams,
    entities: drill.entities.map((e) => compact({ ...e })),
    steps,
  }) as Drill;
}
