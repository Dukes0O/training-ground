import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Circle,
  Download,
  HelpCircle,
  Redo2,
  RotateCcw,
  Save,
  Settings,
  Undo2,
} from "lucide-react";
import { PITCH_FORMATS, pitchFormatId, resolvePitch } from "../pitch/formats";
import type { PitchFormatId } from "../model/types";
import {
  runBundleExport,
  runGifExport,
  runPngExport,
  runVideoExport,
} from "../export/runExport";
import { discardChanges, saveNow } from "../api/persistence";
import { redo, undo, useCanRedo, useCanUndo, useEditor } from "../state/store";

function SaveStatus() {
  const dirty = useEditor((s) => s.dirty);
  const saving = useEditor((s) => s.saving);
  const newDraft = useEditor((s) => s.newDraft);
  const savedAt = useEditor((s) => s.savedAt);
  const conflict = useEditor((s) => s.conflict);
  let text: string;
  let cls = "text-zinc-400";
  if (conflict) {
    text = "Conflict";
    cls = "text-red-600 font-medium";
  } else if (saving) {
    text = "Saving…";
  } else if (newDraft) {
    text = "Temporary draft · not saved";
  } else if (dirty) {
    text = "Unsaved changes";
  } else if (savedAt) {
    text = `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } else {
    text = "Saved locally";
  }
  return (
    <span role="status" className={`save-status ${cls}`}>
      <span
        className={dirty || saving || conflict ? "pending-dot" : "live-dot"}
      />
      {text}
    </span>
  );
}

function ExportMenu() {
  const [open, setOpen] = useState(false);
  const settings = useEditor((s) => s.appSettings);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  // Exporting during a live narration take would film the progress modal.
  const busy = useEditor((s) => s.exportJob != null || s.recordingActive);

  const run = (fn: () => Promise<void>) => {
    setOpen(false);
    void fn();
  };

  const item =
    "w-full rounded-md px-2.5 py-1.5 text-left text-sm text-zinc-800 hover:bg-zinc-100 disabled:opacity-50";

  return (
    <div className="relative">
      <button
        ref={trigger}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="button-primary"
      >
        <Download size={14} />
        {busy ? "Exporting…" : "Export"}
        <ChevronDown size={13} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg">
            <button onClick={() => run(runPngExport)} className={item}>
              Snapshot PNG
              <span className="block text-xs text-zinc-500">
                Downloads current frame at 1920 px
              </span>
            </button>
            <button onClick={() => run(runVideoExport)} className={item}>
              Video (MP4)
              <span className="block text-xs text-zinc-500">
                Downloads full animation, {settings.video?.width ?? 1280} px / {settings.video?.fps ?? 30} fps
              </span>
            </button>
            <button onClick={() => run(runGifExport)} className={item}>
              GIF
              <span className="block text-xs text-zinc-500">
                Downloads loopable file, {settings.gif?.width ?? 720} px / {settings.gif?.fps ?? 12} fps
              </span>
            </button>
            <div className="my-1 h-px bg-zinc-100" />
            <button onClick={() => run(runBundleExport)} className={item}>
              Site bundle
              <span className="block text-xs text-zinc-500">
                Project folder: PNG + GIF + video + site handoff files
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function TopBar() {
  const title = useEditor((s) => s.drill.title);
  const pitch = useEditor((s) => s.drill.pitch);
  const gridOn = useEditor((s) => s.gridOn);
  const setTitle = useEditor((s) => s.setTitle);
  const setPitchFormat = useEditor((s) => s.setPitchFormat);
  const setGridOn = useEditor((s) => s.setGridOn);
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const dirty = useEditor((s) => s.dirty);
  const saving = useEditor((s) => s.saving);
  const conflict = useEditor((s) => s.conflict);
  const spec = resolvePitch(pitch);

  return (
    <header className="editor-topbar">
      <div className="editor-title-group">
        <span className="eyebrow">TACTICS BOARD</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          spellCheck={false}
          aria-label="Drill title"
          className="editor-title"
        />
      </div>
      <SaveStatus />
      <div className="editor-header-actions">
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
          onClick={() => void saveNow()}
          disabled={!dirty || saving || conflict != null}
          title="Save drill (Ctrl+S)"
          className="editor-save-button"
        >
          <Save size={15} />
          Save
        </button>
        <button
          onClick={() => void discardChanges()}
          disabled={!dirty || saving}
          title="Discard all unsaved changes"
          className="editor-discard-button"
        >
          <RotateCcw size={15} />
          Discard
        </button>
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
        <div className="h-5 w-px bg-zinc-200" />
        <RecordButton />
        <ExportMenu />
        <button
          onClick={() => useEditor.getState().setHelpOpen(true)}
          title="Shortcuts & gestures (?)"
          className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100"
        >
          <HelpCircle size={17} />
        </button>
        <button
          onClick={() => useEditor.getState().setSettingsOpen(true)}
          title="Settings"
          className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100"
        >
          <Settings size={17} />
        </button>
      </div>
    </header>
  );
}

function RecordButton() {
  const setRecordOpen = useEditor((s) => s.setRecordOpen);
  const busy = useEditor((s) => s.exportJob != null || s.recordingActive);
  return (
    <button
      onClick={() => setRecordOpen(true)}
      disabled={busy}
      title="Record a narrated take (board + your voice)"
      className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
    >
      <Circle size={11} className="fill-red-600 text-red-600" />
      Record
    </button>
  );
}
