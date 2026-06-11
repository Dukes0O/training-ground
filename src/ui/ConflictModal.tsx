import { Modal } from "./Modal";
import { resolveConflict } from "../api/persistence";
import { useEditor } from "../state/store";

export function ConflictModal() {
  const conflict = useEditor((s) => s.conflict);
  const title = useEditor((s) => s.drill.title);
  return (
    <Modal open={conflict != null} title="Drill changed on disk">
      <p className="text-sm leading-relaxed text-zinc-600">
        The file behind <span className="font-medium text-zinc-900">“{title}”</span> was modified
        outside this window — likely by an agent or another editor — while you also have unsaved
        changes here. Which version should win?
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => void resolveConflict("reload")}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Use the disk version
        </button>
        <button
          onClick={() => void resolveConflict("keepMine")}
          className="rounded-md bg-blue-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-900"
        >
          Keep mine (overwrite)
        </button>
      </div>
    </Modal>
  );
}
