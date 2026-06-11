import { cancelExport } from "../export/runExport";
import { useEditor } from "../state/store";

export function ExportProgressModal() {
  const job = useEditor((s) => s.exportJob);
  if (!job) return null;
  const pct = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-[420px] rounded-xl bg-white p-5 shadow-2xl">
        <h2 className="text-sm font-semibold text-zinc-800">Exporting {job.kind}</h2>
        <p className="mt-1 text-xs text-zinc-500">
          {job.phase} — {job.done}/{job.total}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-blue-800 transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={cancelExport}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
