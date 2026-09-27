import type { BoardDisplayOptions } from "./boardDisplay";

export type PlayerRole = "involved" | "supporting";
export type DisplayScope = "all" | PlayerRole;
export type DisplayOverride = "inherit" | "on" | "off";

export interface PlayerDisplayOverrides {
  role?: PlayerRole;
  appearance?: "inherit" | "miniatures" | "classic";
  trail?: DisplayOverride;
  vision?: DisplayOverride;
  scan?: DisplayOverride;
}

export interface ResolvedPlayerDisplay {
  role?: PlayerRole;
  appearance: "miniatures" | "classic";
  trail: boolean;
  vision: boolean;
  scan: boolean;
}

export const DEFAULT_PLAYER_SIZE = 0.5;
export const MIN_PLAYER_SIZE = 0.3;
export const MAX_PLAYER_SIZE = 1.1;

export function normalizePlayerSize(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(MAX_PLAYER_SIZE, Math.max(MIN_PLAYER_SIZE, value)) : DEFAULT_PLAYER_SIZE;
}

export function normalizeDisplayScope(value: unknown): DisplayScope {
  return value === "involved" || value === "supporting" ? value : "all";
}

export function normalizePlayerOverrides(value: unknown): PlayerDisplayOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const result: PlayerDisplayOverrides = {};
  if (raw.role === "involved" || raw.role === "supporting") result.role = raw.role;
  if (raw.appearance === "classic" || raw.appearance === "miniatures") result.appearance = raw.appearance;
  for (const key of ["trail", "vision", "scan"] as const) {
    if (raw[key] === "on" || raw[key] === "off") result[key] = raw[key];
  }
  return result;
}

export function playerOverrides(options: Partial<BoardDisplayOptions>, drillId: string, playerId: string): PlayerDisplayOverrides {
  return options.drillPlayers?.[drillId]?.[playerId] ?? {};
}

function enabled(master: boolean, scope: DisplayScope | undefined, role: PlayerRole | undefined, override: DisplayOverride | undefined): boolean {
  if (!master || override === "off") return false;
  if (override === "on") return true;
  return !scope || scope === "all" || scope === role;
}

/** Masters win; explicit player choices override only the scope, never the master. */
export function resolvePlayerDisplay(options: Partial<BoardDisplayOptions>, drillId: string, playerId: string): ResolvedPlayerDisplay {
  const overrides = playerOverrides(options, drillId, playerId);
  const role = overrides.role;
  const miniatureOverride = overrides.appearance === "miniatures" ? "on" : overrides.appearance === "classic" ? "off" : "inherit";
  const vision = enabled(options.vision === true, options.visionScope, role, overrides.vision);
  return {
    role,
    appearance: enabled(options.appearance !== "classic", options.appearanceScope, role, miniatureOverride) ? "miniatures" : "classic",
    trail: enabled(options.playerTrails === true, options.trailScope, role, overrides.trail),
    vision,
    scan: vision && enabled(options.scan === true, options.scanScope, role, overrides.scan),
  };
}

/** Presets reset this drill's overrides while keeping explicit role assignments. */
export function withPlayerDisplayPreset(options: BoardDisplayOptions, drillId: string, preset: "simple" | "involved"): BoardDisplayOptions {
  const players = Object.fromEntries(Object.entries(options.drillPlayers[drillId] ?? {}).map(([id, value]) => [id, value.role ? { role: value.role } : {}]));
  return {
    ...options,
    drillPlayers: { ...options.drillPlayers, [drillId]: players },
    cameraMode: "full",
    ...(preset === "simple" ? {
      appearance: "classic", playerTrails: false, ballTrail: false, vision: false, scan: false, surroundings: "none",
    } as const : {
      appearance: "miniatures", appearanceScope: "involved", playerTrails: true, trailScope: "involved", ballTrail: true,
      vision: true, visionScope: "involved", scan: true, scanScope: "involved",
    } as const),
  };
}
