import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title: string;
  width?: number;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, width = 480, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    // Native modal dialogs contain keyboard focus and make the board behind them inert.
    dialog?.showModal();
    titleRef.current?.focus();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [open]);

  if (!open) return null;
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-modal="true"
      className="m-auto overflow-hidden rounded-xl border border-zinc-200 bg-white p-0 shadow-2xl backdrop:bg-black/40"
      style={{ width, maxWidth: "calc(100vw - 2rem)" }}
      onCancel={(event) => {
        // A conflict must be resolved explicitly; no onClose means no dismissal.
        event.preventDefault();
        onClose?.();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="flex max-h-[85dvh] flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 ref={titleRef} id={titleId} tabIndex={-1} className="text-sm font-semibold text-zinc-800 outline-none">{title}</h2>
          {onClose && (
            <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  );
}
