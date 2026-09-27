import type { Annotation, Drill, Entity, Point } from "./types";
import { APRON, resolvePitch } from "../pitch/formats";

function annotation(entity: Entity): entity is Annotation {
  return entity.kind === "arrow" || entity.kind === "zone" || entity.kind === "label";
}

/** Clone the complete selected choreography without materializing sparse steps. */
export function duplicateSelection(drill: Drill, selected: readonly string[]): { drill: Drill; ids: string[]; idMap: Record<string, string> } {
  const selectedIds = new Set(selected);
  const originals = drill.entities.filter((entity) => selectedIds.has(entity.id));
  if (!originals.length) return { drill, ids: [], idMap: {} };
  const taken = new Set(drill.entities.map((entity) => entity.id));
  const ids = new Map<string, string>();
  for (const entity of originals) {
    const base = `${entity.id}-copy`;
    let id = base, suffix = 2;
    while (taken.has(id)) id = `${base}-${suffix++}`;
    taken.add(id);
    ids.set(entity.id, id);
  }
  const allPoints: Point[] = [];
  for (const entity of originals) {
    if (annotation(entity)) {
      for (const end of [entity.from, entity.to]) if (end && !("ref" in end)) allPoints.push(end);
      allPoints.push(...(entity.via ?? []), ...(entity.points ?? []));
      if (entity.rect) allPoints.push({ x: entity.rect.x, y: entity.rect.y }, { x: entity.rect.x + entity.rect.w, y: entity.rect.y + entity.rect.h });
    }
    for (const step of drill.steps) {
      const pose = step.positions[entity.id];
      if (pose) allPoints.push(pose, ...(pose.via ?? []));
    }
  }
  const spec = resolvePitch(drill.pitch);
  const offset = (axis: "x" | "y", limit: number) => {
    if (!allPoints.length) return 2;
    const minimum = -APRON - Math.min(...allPoints.map((point) => point[axis]));
    const maximum = limit + APRON - Math.max(...allPoints.map((point) => point[axis]));
    if (minimum > maximum) return 0; // Existing oversized content remains unchanged in size.
    if (maximum >= 2 && minimum <= 2) return 2;
    if (minimum <= -2 && maximum >= -2) return -2;
    return Math.min(Math.max(2, minimum), maximum);
  };
  const dx = offset("x", spec.length), dy = offset("y", spec.width);
  const translate = (point: Point): Point => ({ x: point.x + dx, y: point.y + dy });
  const copies = originals.map((entity): Entity => {
    if (!annotation(entity)) return { ...entity, id: ids.get(entity.id)! };
    const copy: Annotation = { ...entity, id: ids.get(entity.id)! };
    for (const key of ["from", "to"] as const) {
      const end = entity[key];
      // External anchors retain their original link; internal links follow the copies.
      if (end) copy[key] = "ref" in end ? { ref: ids.get(end.ref) ?? end.ref } : translate(end);
    }
    if (entity.via) copy.via = entity.via.map(translate);
    if (entity.points) copy.points = entity.points.map(translate);
    if (entity.rect) copy.rect = { ...entity.rect, x: entity.rect.x + dx, y: entity.rect.y + dy };
    return copy;
  });
  const steps = drill.steps.map((step) => {
    const positions = { ...step.positions };
    for (const entity of originals) {
      const pose = step.positions[entity.id];
      if (!pose) continue;
      positions[ids.get(entity.id)!] = { ...pose, ...translate(pose), ...(pose.via ? { via: pose.via.map(translate) } : {}) };
    }
    return { ...step, positions };
  });
  return { drill: { ...drill, entities: [...drill.entities, ...copies], steps }, ids: [...ids.values()], idMap: Object.fromEntries(ids) };
}
