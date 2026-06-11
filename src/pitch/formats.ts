import type { PitchFormatId, PitchRef } from "../model/types";

/** Width of the out-of-bounds staging area drawn around the pitch, in meters. */
export const APRON = 3;

export interface PitchSpec {
  id: PitchFormatId;
  label: string;
  length: number;
  width: number;
  /** both = full pitch, single = half-pitch (one goal), none = blank training area */
  ends: "both" | "single" | "none";
  centerCircleRadius?: number;
  penaltyArea?: { depth: number; width: number };
  goalArea?: { depth: number; width: number };
  penaltySpot?: number;
  penaltyArc?: boolean;
  cornerArcRadius?: number;
  goal?: { width: number; depth: number };
  grid?: { spacing: number; defaultOn: boolean };
  /** Multiplier applied to token glyph sizes so pieces stay legible per format. */
  tokenScale: number;
}

export const PITCH_FORMATS: Record<PitchFormatId, PitchSpec> = {
  "11v11": {
    id: "11v11",
    label: "11v11 · Full pitch",
    length: 100,
    width: 64,
    ends: "both",
    centerCircleRadius: 9.15,
    penaltyArea: { depth: 16.5, width: 40.32 },
    goalArea: { depth: 5.5, width: 18.32 },
    penaltySpot: 11,
    penaltyArc: true,
    cornerArcRadius: 1,
    goal: { width: 7.32, depth: 2 },
    tokenScale: 1.05,
  },
  "9v9": {
    id: "9v9",
    label: "9v9 · U11/U12",
    length: 70,
    width: 50,
    ends: "both",
    centerCircleRadius: 7,
    penaltyArea: { depth: 12, width: 29 },
    penaltySpot: 8,
    goal: { width: 5.5, depth: 1.5 },
    tokenScale: 0.85,
  },
  "8v8": {
    id: "8v8",
    label: "8v8",
    length: 60,
    width: 40,
    ends: "both",
    centerCircleRadius: 6,
    penaltyArea: { depth: 10, width: 24 },
    penaltySpot: 8,
    goal: { width: 4.88, depth: 1.5 },
    tokenScale: 0.78,
  },
  "half-11v11": {
    id: "half-11v11",
    label: "Half pitch · 11v11",
    length: 50,
    width: 64,
    ends: "single",
    centerCircleRadius: 9.15,
    penaltyArea: { depth: 16.5, width: 40.32 },
    goalArea: { depth: 5.5, width: 18.32 },
    penaltySpot: 11,
    penaltyArc: true,
    cornerArcRadius: 1,
    goal: { width: 7.32, depth: 2 },
    tokenScale: 0.9,
  },
  grid: {
    id: "grid",
    label: "Training grid",
    length: 40,
    width: 30,
    ends: "none",
    grid: { spacing: 5, defaultOn: true },
    tokenScale: 0.6,
  },
};

export function pitchFormatId(ref: PitchRef): PitchFormatId {
  return typeof ref === "string" ? ref : ref.format;
}

export function resolvePitch(ref: PitchRef): PitchSpec {
  const base = PITCH_FORMATS[pitchFormatId(ref)] ?? PITCH_FORMATS["9v9"];
  if (typeof ref === "string" || !ref.overrides) return base;
  const { length, width } = ref.overrides;
  return {
    ...base,
    length: length ?? base.length,
    width: width ?? base.width,
  };
}

export function defaultGridOn(ref: PitchRef): boolean {
  const spec = resolvePitch(ref);
  if (!spec.grid) return false;
  if (typeof ref !== "string" && ref.overrides?.gridOn != null) return ref.overrides.gridOn;
  return spec.grid.defaultOn;
}
