// Core data model. Units are meters everywhere; origin is the pitch's top-left
// corner, x runs along the length (0 = left goal line), y across the width.
// Entities may sit in the 3 m apron around the pitch (negative coords are legal).

export interface Point {
  x: number;
  y: number;
}

export type EaseName = "linear" | "easeIn" | "easeOut" | "easeInOut" | "instant";

export type TeamId = "home" | "away" | "neutral";

export interface TeamStyle {
  label: string;
  fill: string;
  text: string;
}

export type PitchFormatId = "11v11" | "9v9" | "8v8" | "half-11v11" | "grid";

export interface PitchOverrides {
  length?: number;
  width?: number;
  gridOn?: boolean;
}

export type PitchRef = PitchFormatId | { format: PitchFormatId; overrides?: PitchOverrides };

export interface Player {
  kind: "player";
  id: string;
  team: TeamId;
  number?: number;
  name?: string;
  position?: string; // "GK", "LB", "CM", ...
  rosterRef?: string;
}

export interface Ball {
  kind: "ball";
  id: string;
}

export type EquipmentKind = "cone" | "flat" | "minigoal" | "ladder" | "mannequin" | "pole" | "hurdle";

export interface Equipment {
  kind: EquipmentKind;
  id: string;
  color?: string;
}

export type ArrowStyle = "pass" | "run" | "dribble" | "shot" | "plain";

/** A point, or an entity id whose current position the endpoint tracks. */
export type AnchorPoint = Point | { ref: string };

export interface Annotation {
  kind: "arrow" | "zone" | "label";
  id: string;
  style?: ArrowStyle;
  from?: AnchorPoint;
  to?: AnchorPoint;
  via?: Point[];
  rect?: { x: number; y: number; w: number; h: number };
  text?: string;
  color?: string;
  /** Visible from this step index (inclusive). Default: every step. */
  fromStep?: number;
  /** Visible through this step index (inclusive). Default: every step. */
  toStep?: number;
}

export type Entity = Player | Ball | Equipment | Annotation;

export interface Pose {
  x: number;
  y: number;
  rotation?: number;
  /** Waypoints traversed on the way INTO this step (Catmull-Rom path). */
  via?: Point[];
  ease?: EaseName;
  hidden?: boolean;
}

export interface Step {
  name?: string;
  /** Time animating INTO this step from the previous one. steps[0]: initial hold. */
  durationMs?: number;
  /** Freeze on this pose after arriving — a coaching beat. */
  pauseAfterMs?: number;
  ease?: EaseName;
  /** Keyed by entity id. Sparse is legal: poses forward-fill from earlier steps. */
  positions: Record<string, Pose>;
}

export interface Drill {
  $schema?: string;
  schemaVersion: 1;
  /** Slug; must match the filename under drills/. */
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  notes?: string;
  themeColor?: string;
  pitch: PitchRef;
  teams?: Partial<Record<TeamId, Partial<TeamStyle>>>;
  entities: Entity[];
  steps: Step[];
  createdAt?: string;
  updatedAt?: string;
  rev?: number;
}

export const DEFAULT_TEAM_STYLES: Record<TeamId, TeamStyle> = {
  home: { label: "Home", fill: "#1d4ed8", text: "#ffffff" },
  away: { label: "Away", fill: "#dc2626", text: "#ffffff" },
  neutral: { label: "Neutral", fill: "#f59e0b", text: "#292524" },
};

export function resolveTeamStyles(drill: Drill): Record<TeamId, TeamStyle> {
  const out = {} as Record<TeamId, TeamStyle>;
  for (const team of ["home", "away", "neutral"] as TeamId[]) {
    out[team] = { ...DEFAULT_TEAM_STYLES[team], ...drill.teams?.[team] };
  }
  return out;
}

export const DEFAULT_STEP_DURATION_MS = 2000;
export const DEFAULT_FIRST_HOLD_MS = 800;
export const DEFAULT_PAUSE_AFTER_MS = 300;
