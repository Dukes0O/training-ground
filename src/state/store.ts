import { create } from "zustand";
import { useStore } from "zustand";
import { temporal } from "zundo";
import { immer } from "zustand/middleware/immer";
import type { Drill, PitchFormatId, Player, Point, TeamId } from "../model/types";
import { APRON, defaultGridOn, resolvePitch } from "../pitch/formats";

export type Tool = "select" | "add-home" | "add-away" | "add-neutral" | "add-ball" | "add-cone";

function defaultDrill(): Drill {
  const spec = resolvePitch("9v9");
  return {
    schemaVersion: 1,
    id: "untitled",
    title: "Untitled drill",
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

interface EditorState {
  drill: Drill;
  selection: string[];
  tool: Tool;
  currentStep: number;
  gridOn: boolean;
  /** Drill state captured at gesture start so a whole drag is one undo entry. */
  gestureBase: Drill | null;

  setTool: (tool: Tool) => void;
  select: (ids: string[], additive?: boolean) => void;
  clearSelection: () => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setPitchFormat: (format: PitchFormatId) => void;
  setGridOn: (on: boolean) => void;
  addPlayer: (team: TeamId, pt: Point) => void;
  addBall: (pt: Point) => void;
  addCone: (pt: Point) => void;
  moveEntity: (id: string, pt: Point) => void;
  updatePlayer: (id: string, patch: Partial<Omit<Player, "kind" | "id">>) => void;
  setEquipmentColor: (id: string, color: string) => void;
  removeSelected: () => void;
  nudgeSelection: (dx: number, dy: number) => void;
  beginGesture: () => void;
  endGesture: () => void;
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
        drill: defaultDrill(),
        selection: [],
        tool: "select",
        currentStep: 0,
        gridOn: defaultGridOn("9v9"),
        gestureBase: null,

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
        setPitchFormat: (format) =>
          set((s) => {
            s.drill.pitch = format;
            s.gridOn = defaultGridOn(format);
          }),
        setGridOn: (on) =>
          set((s) => {
            s.gridOn = on;
          }),
        addPlayer: (team, pt) =>
          set((s) => {
            const id = uniqueId(s.drill, `p-${team}-${nextNumber(s.drill, team)}`);
            s.drill.entities.push({ kind: "player", id, team, number: nextNumber(s.drill, team) });
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
        addCone: (pt) =>
          set((s) => {
            const id = uniqueId(s.drill, "cone");
            s.drill.entities.push({ kind: "cone", id });
            s.drill.steps[s.currentStep].positions[id] = clamp(s.drill, pt);
            s.selection = [id];
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
            // Nothing changed during the gesture.
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
