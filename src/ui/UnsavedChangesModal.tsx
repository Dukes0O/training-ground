import { Modal } from "./Modal";

interface UnsavedChangesModalProps {
  open: boolean;
  title: string;
  newDraft: boolean;
  busy: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesModal({
  open,
  title,
  newDraft,
  busy,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesModalProps) {
  return (
    <Modal open={open} onClose={busy ? undefined : onCancel} title="Save your changes?" width={460}>
      <p className="text-sm leading-relaxed text-zinc-600">
        {newDraft ? (
          <>
            <span className="font-medium text-zinc-900">“{title}”</span> is still a temporary
            draft. Save it to add it to your drill library, or discard it to leave without
            creating a file.
          </>
        ) : (
          <>
            Your changes to <span className="font-medium text-zinc-900">“{title}”</span> are only
            in this draft. Save them, or discard them and restore the last saved version.
          </>
        )}
      </p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
        >
          Keep editing
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={busy}
          className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Discard changes
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="rounded-md bg-emerald-800 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-50"
        >
          {busy ? "Working…" : "Save and continue"}
        </button>
      </div>
    </Modal>
  );
}
