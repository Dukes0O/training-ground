import { Modal } from "./Modal";
import { useEditor } from "../state/store";

const SHORTCUTS: [string, string][] = [
  ["Space", "Play / pause"],
  [", and .", "Previous / next step"],
  ["Arrow keys", "Nudge selection 0.5 m (Shift = 2 m)"],
  ["Delete", "Remove selected pieces"],
  ["Esc", "Back to the select tool / clear selection"],
  ["Ctrl+Z / Ctrl+Y", "Undo / redo"],
  ["Ctrl+S", "Save now (autosave runs anyway)"],
  ["?", "This help"],
];

const GESTURES: [string, string][] = [
  ["Drag on empty pitch", "Marquee-select a group (Shift adds)"],
  ["Drag a selected piece", "Move the whole selected group"],
  ["Arrow/zone tools: drag", "Draw — arrow ends snap to players and follow them"],
  ["Drag arrow end handles", "Re-aim or re-anchor a selected arrow"],
  ["Scroll wheel", "Zoom toward the cursor"],
  ["Middle-drag / Alt+drag", "Pan the board"],
  ["Step card drag", "Reorder steps"],
  ["Hover between step cards", "+ inserts a step there"],
];

export function HelpDialog() {
  const open = useEditor((s) => s.helpOpen);
  const setHelpOpen = useEditor((s) => s.setHelpOpen);
  return (
    <Modal open={open} onClose={() => setHelpOpen(false)} title="Shortcuts & gestures" width={520}>
      <div className="grid grid-cols-2 gap-x-6">
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Keyboard</h3>
          <dl className="space-y-1">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-2 text-sm">
                <dt className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700">{k}</dt>
                <dd className="text-right text-xs text-zinc-600">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Mouse</h3>
          <dl className="space-y-1">
            {GESTURES.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-2 text-sm">
                <dt className="shrink-0 text-xs font-medium text-zinc-700">{k}</dt>
                <dd className="text-right text-xs text-zinc-600">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <p className="mt-3 border-t border-zinc-100 pt-2 text-xs text-zinc-500">
        Tip: ask Claude Code or Codex in this repo to draft a drill for you — describe it in plain
        coaching language and it lands in the library in seconds (see docs/drill-authoring.md).
      </p>
    </Modal>
  );
}
