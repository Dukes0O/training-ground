import { create } from "zustand";
import { useStore } from "zustand";
import { temporal } from "zundo";
import { immer } from "zustand/middleware/immer";
import type {
  AnchorPoint,
  Annotation,
  ArrowStyle,
  Drill,
  EaseName,
  EquipmentKind,
  PitchFormatId,
  Player,
  Point,
  Step,
  TeamId,
} from "../model/types";
import type { DrillSummary, RostersFile } from "../api/client";
import { getTimeline, posesAtStep, stepAtTime } from "../model/resolve";
import { APRON, defaultGridOn, pitchFormatId, resolvePitch } from "../pitch/formats";

export type Tool =
  | "select"
  | "add-home"
  | "add-away"
  | "add-neutral"
  | "add-ball"
  | "add-cone"
  | "add-flat"
  | "add-minigoal"
  | "add-ladder"
  | "add-mannequin"
  | "add-pole"
  | "add-hurdle"
  | "draw-pass"
  | "draw-run"
  | "draw-dribble"
  | "draw-shot"
  | "draw-zone"
  | "add-label";

export const EQUIPMENT_TOOLS = [
  "add-cone",
  "add-flat",
  "add-minigoal",
  "add-ladder",
  "add-mannequin",
  "add-pole",
  "add-hurdle",
] as const;

export const ARROW_TOOLS = ["draw-pass", "draw-run", "draw-dribble", "draw-shot"] as const;

export interface Toast {
  id: number;
  kind: "info" | "success" | "error";
  text: string;
}

export function makeDefaultDrill(id: string, title = "Untitled drill"): Drill {
  const spec = resolvePitch("9v9");
  return {
    schemaVersion: 1,
    id,
    title,
    pitch: "9v9",
    entities: [{ kind: "ball", id: "ball" }],
    steps: [{ name: "Setup", positions: { ball: { x: spec.length / 2, y: spec.width / 2 } } }],
  };
}

function uniqueId(drill: Drill, prefix: string): string {
  const taken = new Set(drill.entities.map((e) => e.id));
  if (!taken.has(prefix)) return prefix;
  let i = 2;
  while (taken.has(`${prefix}-${i}`)) i++;
  return `${prefix}-${i}`;
}

function nextNumber(drill: Drill, team: TeamId): number {
  let max = 0;
  for (const e of drill.entities) {
    if (e.kind === "player" && e.team === team && e.number != null) max = Math.max(max, e.number);
  }
  return Math.min(max + 1, 99);
}

let toastSeq = 1;

function remapAnnotationSteps(drill: Drill, map: (i: number) => number) {
  for (const e of drill.entities) {
    if (e.kind !== "arrow" && e.kind !== "zone" && e.kind !== "label") continue;
    if (e.fromStep != null) e.fromStep = map(e.fromStep);
    if (e.toStep != null) e.toStep = map(e.toStep);
    if (e.fromStep != null && e.toStep != null && e.fromStep > e.toStep) {
      const t = e.fromStep;
      e.fromStep = e.toStep;
      e.toStep = t;
    }
  }
}

interface EditorState {
  drill: Drill;
  /** Id of the file this drill is bound to; null only before boot finishes. */
  drillId: string | null;
  lastSavedRev: number | null;
  savedAt: string | null;
  dirty: boolean;
  saving: boolean;
  conflict: { diskRev: number | null } | null;

  library: DrillSummary[] | null;
  rosters: RostersFile;

  selection: string[];
  tool: Tool;
  currentStep: number;
  gridOn: boolean;
  rosterOpen: boolean;
  toasts: Toast[];
  /** Drill state captured at gesture start so a whole drag is one undo entry. */
  gestureBase: Drill | null;

  mode: "edit" | "playback";
  playing: boolean;
  timeMs: number;
  speed: number;
  loop: boolean;

  setTool: (tool: Tool) => void;
  select: (ids: string[], additive?: boolean) => void;
  clearSelection: () => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setTags: (tags: string[]) => void;
  setPitchFormat: (format: PitchFormatId) => void;
  setGridOn: (on: boolean) => void;
  addPlayer: (team: TeamId, pt: Point) => void;
  addBall: (pt: Point) => void;
  addEquipment: (kind: EquipmentKind, pt: Point) => void;
  addLabel: (pt: Point) => void;
  addArrow: (style: ArrowStyle, from: AnchorPoint, to: AnchorPoint, via?: Point[]) => void;
  addZone: (rect: { x: number; y: number; w: number; h: number }) => void;
  updateAnnotation: (id: string, patch: Partial<Omit<Annotation, "kind" | "id">>) => void;
  moveEntity: (id: string, pt: Point) => void;
  updatePlayer: (id: string, patch: Partial<Omit<Player, "kind" | "id">>) => void;
  setEquipmentColor: (id: string, color: string) => void;
  setEntityRotation: (id: string, rotation: number) => void;
  removeSelected: () => void;
  nudgeSelection: (dx: number, dy: number) => void;
  beginGesture: () => void;
  endGesture: () => void;
  resetPoseAtCurrentStep: (id: string) => void;

  setMode: (mode: "edit" | "playback") => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setTimeMs: (timeMs: number) => void;
  setSpeed: (speed: number) => void;
  setLoop: (loop: boolean) => void;
  jumpToStep: (k: number) => void;
  addStepAfter: (k?: number) => void;
  duplicateStep: (k: number) => void;
  deleteStep: (k: number) => void;
  moveStep: (from: number, to: number) => void;
  updateStepMeta: (
    k: number,
    patch: { name?: string | null; durationMs?: number | null; pauseAfterMs?: number | null; ease?: EaseName | null }
  ) => void;

  applyLoadedDrill: (drill: Drill, rev: number) => void;
  setSaving: (saving: boolean) => void;
  setConflict: (conflict: { diskRev: number | null } | null) => void;
  setLibrary: (library: DrillSummary[]) => void;
  setRosters: (rosters: RostersFile) => void;
  setRosterOpen: (open: boolean) => void;
  addToast: (kind: Toast["kind"], text: string) => void;
  removeToast: (id: number) => void;
}

export const useEditor = create<EditorState>()(
  temporal(
    immer((set, get) => {
      const clamp = (drill: Drill, pt: Point): Point => {
        const spec = resolvePitch(drill.pitch);
        return {
          x: Math.min(Math.max(pt.x, -APRON), spec.length + APRON),
          y: Math.min(Math.max(pt.y, -APRON), spec.width + APRON),
        };
      };
      return {
        drill: makeDefaultDrill("untitled"),
        drillId: null,
        lastSavedRev: null,
        savedAt: null,
        dirty: false,
        saving: false,
        conflict: null,
        library: null,
        rosters: { teams: [] },
        selection: [],
        tool: "select",
        currentStep: 0,
        gridOn: defaultGridOn("9v9"),
        rosterOpen: false,
        toasts: [],
        gestureBase: null,
        mode: "edit",
        playing: false,
        timeMs: 0,
        speed: 1,
        loop: false,

        setTool: (tool) =>
          set((s) => {
            s.tool = tool;
          }),
        select: (ids, additive) =>
          set((s) => {
            s.selection = additive ? [...new Set([...s.selection, ...ids])] : ids;
          }),
        clearSelection: () =>
          set((s) => {
            s.selection = [];
          }),
        setTitle: (title) =>
          set((s) => {
            s.drill.title = title;
          }),
        setDescription: (description) =>
          set((s) => {
            s.drill.description = description;
          }),
        setTags: (tags) =>
          set((s) => {
            s.drill.tags = tags;
          }),
        setPitchFormat: (format) =>
          set((s) => {
            s.drill.pitch = format;
            s.gridOn = defaultGridOn(format);
          }),
        setGridOn: (on) =>
          set((s) => {
            s.gridOn = on;
            const format = pitchFormatId(s.drill.pitch);
            if (resolvePitch(format).grid) {
              const overrides =
                typeof s.drill.pitch === "string" ? {} : { ...s.drill.pitch.overrides };
              s.drill.pitch = { format, overrides: { ...overrides, gridOn: on } };
            }
          }),
        addPlayer: (team, pt) =>
          set((s) => {
            const number = nextNumber(s.drill, team);
            const id = uniqueId(s.drill, `p-${team}-${number}`);
            s.drill.entities.push({ kind: "player", id, team, number });
            s.drill.steps[s.currentStep].positions[id] = clamp(s.drill, pt);
            s.selection = [id];
          }),
        addBall: (pt) =>
          set((s) => {
            const id = uniqueId(s.drill, "ball");
            s.drill.entities.push({ kind: "ball", id });
            s.drill.steps[s.currentStep].positions[id] = clamp(s.drill, pt);
            s.selection = [id];
          }),
        addEquipment: (kind, pt) =>
          set((s) => {
            const id = uniqueId(s.drill, kind);
            s.drill.entities.push({ kind, id });
            s.drill.steps[s.currentStep].positions[id] = clamp(s.drill, pt);
            s.selection = [id];
          }),
        addLabel: (pt) =>
          set((s) => {
            const id = uniqueId(s.drill, "label");
            s.drill.entities.push({ kind: "label", id, text: "Text" });
            s.drill.steps[s.currentStep].positions[id] = clamp(s.drill, pt);
            s.selection = [id];
            s.tool = "select";
          }),
        addArrow: (style, from, to, via) =>
          set((s) => {
            const id = uniqueId(s.drill, style === "plain" ? "arrow" : style);
            s.drill.entities.push({
              kind: "arrow",
              id,
              style,
              from,
              to,
              ...(via && via.length > 0 ? { via } : {}),
              fromStep: s.currentStep,
              toStep: s.currentStep,
            });
            s.selection = [id];
          }),
        addZone: (rect) =>
          set((s) => {
            const id = uniqueId(s.drill, "zone");
            s.drill.entities.push({ kind: "zone", id, rect });
            s.selection = [id];
            s.tool = "select";
          }),
        updateAnnotation: (id, patch) =>
          set((s) => {
            const e = s.drill.entities.find((e) => e.id === id);
            if (!e || (e.kind !== "arrow" && e.kind !== "zone" && e.kind !== "label")) return;
            for (const [key, value] of Object.entries(patch)) {
              if (value === undefined) delete (e as unknown as Record<string, unknown>)[key];
              else (e as unknown as Record<string, unknown>)[key] = value;
            }
          }),
        moveEntity: (id, pt) =>
          set((s) => {
            const step = s.drill.steps[s.currentStep];
            const prev = step.positions[id];
            const c = clamp(s.drill, pt);
            step.positions[id] = prev ? { ...prev, x: c.x, y: c.y } : c;
          }),
        updatePlayer: (id, patch) =>
          set((s) => {
            const e = s.drill.entities.find((e) => e.id === id);
            if (e?.kind === "player") Object.assign(e, patch);
          }),
        setEquipmentColor: (id, color) =>
          set((s) => {
            const e = s.drill.entities.find((e) => e.id === id);
            if (e && e.kind !== "player" && e.kind !== "ball" && "color" in e) e.color = color;
          }),
        setEntityRotation: (id, rotation) =>
          set((s) => {
            const step = s.drill.steps[s.currentStep];
            const existing = step.positions[id];
            const normalized = ((rotation % 360) + 360) % 360;
            if (existing) {
              existing.rotation = normalized === 0 ? undefined : normalized;
            } else {
              const resolved = posesAtStep(s.drill, s.currentStep).get(id);
              if (resolved) step.positions[id] = { x: resolved.x, y: resolved.y, rotation: normalized || undefined };
            }
          }),
        removeSelected: () =>
          set((s) => {
            const ids = new Set(s.selection);
            if (ids.size === 0) return;
            s.drill.entities = s.drill.entities.filter((e) => !ids.has(e.id));
            for (const step of s.drill.steps) {
              for (const id of ids) delete step.positions[id];
            }
            s.selection = [];
          }),
        nudgeSelection: (dx, dy) =>
          set((s) => {
            const step = s.drill.steps[s.currentStep];
            for (const id of s.selection) {
              const pose = step.positions[id];
              if (pose) {
                const c = clamp(s.drill, { x: pose.x + dx, y: pose.y + dy });
                pose.x = c.x;
                pose.y = c.y;
              }
            }
          }),
        beginGesture: () => {
          useEditor.temporal.getState().pause();
          set((s) => {
            s.gestureBase = s.drill;
          });
        },
        endGesture: () => {
          const base = get().gestureBase;
          if (!base) {
            useEditor.temporal.getState().resume();
            return;
          }
          const final = get().drill;
          if (final === base) {
            set((s) => {
              s.gestureBase = null;
            });
            useEditor.temporal.getState().resume();
            return;
          }
          // Rewind to the gesture's base while history is paused, then replay
          // the final state as a single tracked change so one drag = one undo.
          set((s) => {
            s.drill = base;
          });
          useEditor.temporal.getState().resume();
          set((s) => {
            s.drill = final;
            s.gestureBase = null;
          });
        },

        resetPoseAtCurrentStep: (id) =>
          set((s) => {
            if (s.currentStep === 0) return;
            delete s.drill.steps[s.currentStep].positions[id];
          }),

        setMode: (mode) =>
          set((s) => {
            if (mode === s.mode) return;
            if (mode === "playback") {
              s.timeMs = getTimeline(s.drill).stepArrivalMs[s.currentStep] ?? 0;
              s.selection = [];
            } else {
              s.currentStep = stepAtTime(getTimeline(s.drill), s.timeMs);
              s.playing = false;
            }
            s.mode = mode;
          }),
        play: () =>
          set((s) => {
            if (s.mode === "edit") {
              s.mode = "playback";
              s.timeMs = getTimeline(s.drill).stepArrivalMs[s.currentStep] ?? 0;
              s.selection = [];
            }
            if (s.timeMs >= getTimeline(s.drill).totalMs - 1) s.timeMs = 0;
            s.playing = true;
          }),
        pause: () =>
          set((s) => {
            s.playing = false;
          }),
        togglePlay: () => {
          if (get().playing) get().pause();
          else get().play();
        },
        setTimeMs: (timeMs) =>
          set((s) => {
            if (s.mode !== "playback") {
              s.mode = "playback";
              s.selection = [];
            }
            s.timeMs = timeMs;
          }),
        setSpeed: (speed) =>
          set((s) => {
            s.speed = speed;
          }),
        setLoop: (loop) =>
          set((s) => {
            s.loop = loop;
          }),
        jumpToStep: (k) =>
          set((s) => {
            const clamped = Math.min(Math.max(k, 0), s.drill.steps.length - 1);
            if (s.mode === "playback") {
              s.timeMs = getTimeline(s.drill).stepArrivalMs[clamped] ?? 0;
            }
            s.currentStep = clamped;
          }),
        addStepAfter: (k) =>
          set((s) => {
            const at = Math.min(k ?? s.currentStep, s.drill.steps.length - 1);
            s.drill.steps.splice(at + 1, 0, { positions: {} });
            remapAnnotationSteps(s.drill, (i) => (i <= at ? i : i + 1));
            s.currentStep = at + 1;
            s.mode = "edit";
            s.playing = false;
          }),
        duplicateStep: (k) =>
          set((s) => {
            const src = s.drill.steps[k];
            if (!src) return;
            const copy: Step = JSON.parse(JSON.stringify(src)) as Step;
            if (copy.name) copy.name = `${copy.name} (copy)`;
            s.drill.steps.splice(k + 1, 0, copy);
            remapAnnotationSteps(s.drill, (i) => (i <= k ? i : i + 1));
            s.currentStep = k + 1;
            s.mode = "edit";
            s.playing = false;
          }),
        deleteStep: (k) =>
          set((s) => {
            if (s.drill.steps.length <= 1 || !s.drill.steps[k]) return;
            const removed = s.drill.steps[k];
            const next = s.drill.steps[k + 1];
            if (next) {
              // Keep continuity and introductions: the removed step's explicit
              // poses fold into the following step (which wins on conflicts).
              next.positions = { ...removed.positions, ...next.positions };
            }
            s.drill.steps.splice(k, 1);
            remapAnnotationSteps(s.drill, (i) => (i < k ? i : i === k ? Math.max(0, k - 1) : i - 1));
            s.currentStep = Math.min(s.currentStep, s.drill.steps.length - 1);
            if (s.currentStep >= k && s.currentStep > 0) s.currentStep = Math.max(0, s.currentStep - 1);
          }),
        moveStep: (from, to) =>
          set((s) => {
            const n = s.drill.steps.length;
            if (from === to || from < 0 || to < 0 || from >= n || to >= n) return;
            const [step] = s.drill.steps.splice(from, 1);
            s.drill.steps.splice(to, 0, step);
            remapAnnotationSteps(s.drill, (i) => {
              if (i === from) return to;
              if (from < to) return i > from && i <= to ? i - 1 : i;
              return i >= to && i < from ? i + 1 : i;
            });
            s.currentStep = to;
          }),
        updateStepMeta: (k, patch) =>
          set((s) => {
            const step = s.drill.steps[k];
            if (!step) return;
            for (const key of ["name", "durationMs", "pauseAfterMs", "ease"] as const) {
              if (!(key in patch)) continue;
              const v = patch[key];
              if (v == null || v === "") delete step[key];
              else (step as Record<string, unknown>)[key] = v;
            }
          }),

        applyLoadedDrill: (drill, rev) =>
          set((s) => {
            s.drill = drill;
            s.drillId = drill.id;
            s.lastSavedRev = rev;
            s.savedAt = drill.updatedAt ?? null;
            s.dirty = false;
            s.saving = false;
            s.conflict = null;
            s.selection = [];
            s.currentStep = 0;
            s.tool = "select";
            s.gridOn = defaultGridOn(drill.pitch);
            s.gestureBase = null;
            s.mode = "edit";
            s.playing = false;
            s.timeMs = 0;
          }),
        setSaving: (saving) =>
          set((s) => {
            s.saving = saving;
          }),
        setConflict: (conflict) =>
          set((s) => {
            s.conflict = conflict;
          }),
        setLibrary: (library) =>
          set((s) => {
            s.library = library;
          }),
        setRosters: (rosters) =>
          set((s) => {
            s.rosters = rosters;
          }),
        setRosterOpen: (open) =>
          set((s) => {
            s.rosterOpen = open;
          }),
        addToast: (kind, text) => {
          const id = toastSeq++;
          set((s) => {
            s.toasts.push({ id, kind, text });
          });
          setTimeout(() => get().removeToast(id), kind === "error" ? 8000 : 4500);
        },
        removeToast: (id) =>
          set((s) => {
            s.toasts = s.toasts.filter((t) => t.id !== id);
          }),
      };
    }),
    {
      partialize: (state) => ({ drill: state.drill }),
      limit: 200,
      equality: (past, current) => past.drill === current.drill,
    }
  )
);

export function undo() {
  useEditor.temporal.getState().undo();
}

export function redo() {
  useEditor.temporal.getState().redo();
}

export function useCanUndo(): boolean {
  return useStore(useEditor.temporal, (s) => s.pastStates.length > 0);
}

export function useCanRedo(): boolean {
  return useStore(useEditor.temporal, (s) => s.futureStates.length > 0);
}
