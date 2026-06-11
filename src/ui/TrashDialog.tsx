import { useEffect, useState } from "react";
import { ArchiveRestore } from "lucide-react";
import { api } from "../api/client";
import type { TrashItem } from "../api/client";
import { refreshLibrarySoon } from "../api/persistence";
import { Modal } from "./Modal";
import { useEditor } from "../state/store";

export function TrashDialog() {
  const open = useEditor((s) => s.trashOpen);
  const setTrashOpen = useEditor((s) => s.setTrashOpen);
  const addToast = useEditor((s) => s.addToast);
  const [items, setItems] = useState<TrashItem[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    void api
      .getTrash()
      .then(setItems)
      .catch(() => setItems([]));
  }, [open]);

  const restore = async (item: TrashItem) => {
    try {
      const r = await api.restoreTrash(item.file);
      addToast("success", `"${r.id}" restored to the library.`);
      refreshLibrarySoon(0);
      setItems((list) => (list ?? []).filter((i) => i.file !== item.file));
    } catch (err) {
      addToast("error", `Restore failed: ${(err as Error).message}`);
    }
  };

  return (
    <Modal open={open} onClose={() => setTrashOpen(false)} title="Trash" width={460}>
      {items === null && <p className="text-sm text-zinc-500">Loading…</p>}
      {items !== null && items.length === 0 && (
        <p className="text-sm text-zinc-500">
          Trash is empty. Deleted drills land in <code className="text-xs">data/trash/</code> and can
          be restored from here.
        </p>
      )}
      {items !== null && items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.file}
              className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-800">{item.id}</div>
                <div className="text-xs text-zinc-500">
                  deleted {new Date(item.deletedAt).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => void restore(item)}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                <ArchiveRestore size={13} />
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
