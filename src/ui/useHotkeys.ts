import { useEffect } from "react";
import { saveNow } from "../api/persistence";
import { redo, undo, useEditor } from "../state/store";

const NUDGE = 0.5;
const NUDGE_BIG = 2;

export function useHotkeys(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      // Never edit the board through an open dialog, including native dialogs.
      if (document.querySelector('dialog[open], [aria-modal="true"]')) return;
      const state = useEditor.getState();
      // Export progress currently uses a separate overlay instead of Modal.
      if (state.exportJob) return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "s") {
        e.preventDefault();
        void saveNow();
        return;
      }
      const t = e.target instanceof Element ? e.target : null;
      if (
        !t ||
        t.closest("input, textarea, select") ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        return;
      }
      // Space must still activate a focused control without toggling playback too.
      if (e.key === " " && t.closest('button, a[href], [role="button"], [role="link"], summary')) return;
      if ((e.ctrlKey || e.metaKey) && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && key === "y") {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && key === "d") {
        e.preventDefault();
        if (state.mode === "edit") state.duplicateSelected();
      } else if (e.key === " ") {
        e.preventDefault();
        state.togglePlay();
      } else if (e.key === ",") {
        state.jumpToStep(state.currentStep - 1);
      } else if (e.key === ".") {
        state.jumpToStep(state.currentStep + 1);
      } else if (e.key === "?") {
        state.setHelpOpen(true);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (state.mode === "edit") state.removeSelected();
      } else if (e.key === "Escape") {
        state.setTool("select");
        state.clearSelection();
      } else if (e.key.startsWith("Arrow")) {
        if (state.selection.length === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? NUDGE_BIG : NUDGE;
        const [dx, dy] =
          e.key === "ArrowLeft"
            ? [-step, 0]
            : e.key === "ArrowRight"
              ? [step, 0]
              : e.key === "ArrowUp"
                ? [0, -step]
                : [0, step];
        state.nudgeSelection(dx, dy);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
