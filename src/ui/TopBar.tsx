import { Redo2, Undo2 } from "lucide-react";
import { PITCH_FORMATS, pitchFormatId, resolvePitch } from "../pitch/formats";
import type { PitchFormatId } from "../model/types";
import { redo, undo, useCanRedo, useCanUndo, useEditor } from "../state/store";

const ACCENT = "#1e40af";

export function TopBar() {
  const title = useEditor((s) => s.drill.title);
  const pitch = useEditor((s) => s.drill.pitch);
  const gridOn = useEditor((s) => s.gridOn);
  const setTitle = useEditor((s) => s.setTitle);
  const setPitchFormat = useEditor((s) => s.setPitchFormat);
  const setGridOn = useEditor((s) => s.setGridOn);
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const spec = resolvePitch(pitch);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3">
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg text-sm text-white"
          style={{ backgroundColor: ACCENT }}
        >
          ⚽
        </div>
        <span className="text-sm font-semibold tracking-tight text-zinc-800">Training Ground</span>
      </div>
      <div className="h-5 w-px bg-zinc-200" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        spellCheck={false}
        aria-label="Drill title"
        className="w-72 rounded-md px-2 py-1 text-sm font-medium text-zinc-900 outline-none transition-colors hover:bg-zinc-100 focus:bg-white focus:ring-2 focus:ring-blue-700/40"
      />
      <div className="ml-auto flex items-center gap-2">
        {spec.grid && (
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100">
            <input
              type="checkbox"
              checked={gridOn}
              onChange={(e) => setGridOn(e.target.checked)}
              className="accent-blue-800"
            />
            Grid
          </label>
        )}
        <select
          value={pitchFormatId(pitch)}
          onChange={(e) => setPitchFormat(e.target.value as PitchFormatId)}
          aria-label="Pitch format"
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-800 outline-none focus:ring-2 focus:ring-blue-700/40"
        >
          {Object.values(PITCH_FORMATS).map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <div className="h-5 w-px bg-zinc-200" />
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-35"
        >
          <Undo2 size={17} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-35"
        >
          <Redo2 size={17} />
        </button>
      </div>
    </header>
  );
}
