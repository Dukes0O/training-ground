import { create } from "zustand";
import { DEFAULT_BOARD_DISPLAY } from "../model/boardDisplay";
import type { BoardDisplayOptions } from "../model/boardDisplay";
import { normalizeDisplayScope, normalizePlayerOverrides, normalizePlayerSize, withPlayerDisplayPreset } from "../model/playerDisplay";
import type { PlayerDisplayOverrides } from "../model/playerDisplay";
import { normalizeCameraTracking } from "../model/cameraTracking";

export const BOARD_DISPLAY_STORAGE_KEY = "training-ground.board-display.v1";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Tolerate old preferences and malformed browser storage without changing drills. */
export function normalizeBoardDisplayOptions(saved: unknown): BoardDisplayOptions {
  const value = record(saved);
  const drillPlayers = Object.fromEntries(Object.entries(record(value.drillPlayers)).map(([drillId, players]) => [
    drillId, Object.fromEntries(Object.entries(record(players)).map(([playerId, overrides]) => [playerId, normalizePlayerOverrides(overrides)])),
  ]));
  return {
    playerTrails: value.playerTrails === true,
    ballTrail: value.ballTrail === true,
    appearance: value.appearance === "classic" ? "classic" : "miniatures",
    vision: value.vision === true,
    scan: value.scan === true,
    view: value.view === "portrait" || value.view === "angled" ? value.view : "landscape",
    pitchStyle: value.pitchStyle === "stadium" || value.pitchStyle === "light" || value.pitchStyle === "dark" ? value.pitchStyle : "grass",
    surroundings: value.surroundings === "stadium" ? "stadium" : "none",
    stadiumLabel: typeof value.stadiumLabel === "string" ? value.stadiumLabel.slice(0, 40) : DEFAULT_BOARD_DISPLAY.stadiumLabel,
    stadiumAccent: typeof value.stadiumAccent === "string" && /^#[\da-f]{6}$/i.test(value.stadiumAccent) ? value.stadiumAccent : DEFAULT_BOARD_DISPLAY.stadiumAccent,
    playerSize: normalizePlayerSize(value.playerSize),
    playerLabels: value.playerLabels === "number" || value.playerLabels === "hidden" ? value.playerLabels : "number-role",
    appearanceScope: normalizeDisplayScope(value.appearanceScope),
    trailScope: normalizeDisplayScope(value.trailScope),
    visionScope: normalizeDisplayScope(value.visionScope),
    scanScope: normalizeDisplayScope(value.scanScope),
    drillPlayers,
    ...normalizeCameraTracking(value),
  };
}

function loadOptions(): BoardDisplayOptions {
  try { return normalizeBoardDisplayOptions(JSON.parse(localStorage.getItem(BOARD_DISPLAY_STORAGE_KEY) ?? "null")); }
  catch { return normalizeBoardDisplayOptions(null); }
}

function saveOptions(options: BoardDisplayOptions) {
  try { localStorage.setItem(BOARD_DISPLAY_STORAGE_KEY, JSON.stringify(options)); } catch { /* Usable without browser storage. */ }
  return { options };
}

interface BoardDisplayState {
  options: BoardDisplayOptions;
  setOptions: (patch: Partial<BoardDisplayOptions>) => void;
  setPlayerOptions: (drillId: string, playerIds: string[], patch: PlayerDisplayOverrides) => void;
  assignInvolvedPlayers: (drillId: string, allPlayerIds: string[], involvedIds: string[]) => void;
  applyPreset: (drillId: string, preset: "simple" | "involved") => void;
}

/** Independent of the drill store: preferences cannot dirty/save/undo a drill. */
export const useBoardDisplay = create<BoardDisplayState>((set) => ({
  options: loadOptions(),
  applyPreset: (drillId, preset) => set((state) => saveOptions(withPlayerDisplayPreset(state.options, drillId, preset))),
  setOptions: (patch) => set((state) => saveOptions(normalizeBoardDisplayOptions({ ...state.options, ...patch }))),
  setPlayerOptions: (drillId, playerIds, patch) => set((state) => {
    const players = { ...state.options.drillPlayers[drillId] };
    for (const id of playerIds) players[id] = normalizePlayerOverrides({ ...players[id], ...patch });
    return saveOptions({ ...state.options, drillPlayers: { ...state.options.drillPlayers, [drillId]: players } });
  }),
  assignInvolvedPlayers: (drillId, allPlayerIds, involvedIds) => set((state) => {
    const players = { ...state.options.drillPlayers[drillId] };
    const involved = new Set(involvedIds);
    for (const id of allPlayerIds) players[id] = { ...players[id], role: involved.has(id) ? "involved" : "supporting" };
    return saveOptions({ ...state.options, drillPlayers: { ...state.options.drillPlayers, [drillId]: players } });
  }),
}));
