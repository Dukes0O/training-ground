import type { ResolvedItem } from "./resolve";

/** A coaching illustration, not a measurement of a player's visual field. */
export const VISION_CONE_DEGREES = 70;
export const SCAN_AMPLITUDE_DEGREES = 18;
export const SCAN_PERIOD_MS = 3200;

function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** Authored gaze takes priority over travel direction, including explicit 0°. */
export function gazeBearing(item: Pick<ResolvedItem, "pose" | "heading">): number {
  const authored = item.pose.rotation;
  if (authored != null && Number.isFinite(authored)) return normalizeDegrees(authored);
  return normalizeDegrees(Number.isFinite(item.heading) ? item.heading! : 0);
}

/** Pure timeline sampling keeps paused, scrubbed and exported cones identical. */
export function scanOffset(timeMs: number, playerId: string): number {
  let hash = 0;
  for (const char of playerId) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  const time = Number.isFinite(timeMs) ? Math.max(0, timeMs) : 0;
  const cycle = (time % SCAN_PERIOD_MS) / SCAN_PERIOD_MS;
  return Math.sin((cycle + hash / 997) * Math.PI * 2) * SCAN_AMPLITUDE_DEGREES;
}

export function visionBearing(item: ResolvedItem, timeMs: number, scanning: boolean): number {
  return normalizeDegrees(gazeBearing(item) + (scanning ? scanOffset(timeMs, item.entity.id) : 0));
}
