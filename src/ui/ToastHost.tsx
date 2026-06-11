import { X } from "lucide-react";
import { useEditor } from "../state/store";

const KIND_CLS: Record<string, string> = {
  info: "border-zinc-200 bg-white text-zinc-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-900",
};

export function ToastHost() {
  const toasts = useEditor((s) => s.toasts);
  const removeToast = useEditor((s) => s.removeToast);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-96 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg ${KIND_CLS[t.kind]}`}
        >
          <span className="min-w-0 flex-1 break-words leading-snug">{t.text}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
