import { useEffect } from "react";
import { saveNow } from "../api/persistence";
import { redo, undo, useEditor } from "../state/store";

const NUDGE = 0.5;
const NUDGE_BIG = 2;

export function useHotkeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT" ||
        t.isContentEditable
      ) {
        return;
      }
      const state = useEditor.getState();
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "s") {
        e.preventDefault();
        void saveNow(true);
      } else if ((e.ctrlKey || e.metaKey) && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && key === "y") {
        e.preventDefault();
        redo();
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
  }, []);
}
