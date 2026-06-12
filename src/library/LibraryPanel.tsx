import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArchiveRestore, Copy, Plus, Search, Trash2, Users } from "lucide-react";
import { api } from "../api/client";
import type { DrillSummary } from "../api/client";
import { deleteDrillById, duplicateDrill, newDrill, openDrill } from "../api/persistence";
import { BoardSvg } from "../board/BoardSvg";
import { parseDrill } from "../model/schema";
import { snapshotAtStep } from "../model/resolve";
import type { Drill } from "../model/types";
import { APRON, defaultGridOn, resolvePitch } from "../pitch/formats";
import { useEditor } from "../state/store";

const previewCache = new Map<string, Drill | "error">();

function usePreviewDrill(id: string, rev: number | undefined, invalid: boolean | undefined) {
  const key = `${id}@${rev ?? 0}`;
  const [value, setValue] = useState<Drill | "error" | null>(() =>
    invalid ? "error" : (previewCache.get(key) ?? null)
  );
  useEffect(() => {
    if (invalid) {
      setValue("error");
      return;
    }
    const cached = previewCache.get(key);
    if (cached) {
      setValue(cached);
      return;
    }
    let alive = true;
    api
      .getDrill(id)
      .then((raw) => {
        const drill = parseDrill(raw);
        previewCache.set(key, drill);
        if (alive) setValue(drill);
      })
      .catch(() => {
        previewCache.set(key, "error");
        if (alive) setValue("error");
      });
    return () => {
      alive = false;
    };
  }, [key, id, invalid]);
  return value;
}

function PreviewBox({ drill }: { drill: Drill | "error" | null }) {
  if (drill === "error" || drill === null) {
    return (
      <div className="flex aspect-[3/2] w-full items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-zinc-400">
        {drill === "error" ? <AlertTriangle size={18} /> : null}
      </div>
    );
  }
  const spec = resolvePitch(drill.pitch);
  const aspect = (spec.length + 2 * APRON) / (spec.width + 2 * APRON);
  return (
    <div
      className="pointer-events-none w-full overflow-hidden rounded-md border border-zinc-200"
      style={{ aspectRatio: String(aspect) }}
    >
      <BoardSvg snapshot={snapshotAtStep(drill, 0, defaultGridOn(drill.pitch))} />
    </div>
  );
}

function LibraryCard({ item }: { item: DrillSummary }) {
  const activeId = useEditor((s) => s.drillId);
  const liveDrill = useEditor((s) => s.drill);
  const isActive = item.id === activeId;
  const fetched = usePreviewDrill(item.id, item.rev, item.invalid);
  const preview = isActive ? liveDrill : fetched;

  return (
    <div
      onClick={() => {
        if (!isActive && !item.invalid) void openDrill(item.id);
      }}
      className={`group cursor-pointer rounded-lg border p-2 transition-colors ${
        isActive
          ? "border-blue-800/40 bg-blue-50/60 ring-1 ring-blue-800/30"
          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      <PreviewBox drill={preview} />
      <div className="mt-1.5 flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-zinc-900">{item.title}</div>
          <div className="truncate text-xs text-zinc-500">
            {item.invalid
              ? `Invalid file: ${item.error ?? "parse error"}`
              : [
                  typeof item.pitch === "string" ? item.pitch : item.pitch?.format,
                  `${item.stepCount ?? 0} step${(item.stepCount ?? 0) === 1 ? "" : "s"}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button
            title="Duplicate drill"
            onClick={(e) => {
              e.stopPropagation();
              void duplicateDrill(item.id);
            }}
            className="rounded-md p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-blue-50 hover:text-blue-700 group-hover:opacity-100"
          >
            <Copy size={14} />
          </button>
          <button
            title="Move to trash"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Move "${item.title}" to data/trash?`)) {
                void deleteDrillById(item.id);
              }
            }}
            className="rounded-md p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {item.tags && item.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {item.tags.map((t) => (
            <span key={t} className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function LibraryPanel() {
  const library = useEditor((s) => s.library);
  const setRosterOpen = useEditor((s) => s.setRosterOpen);
  const [q, setQ] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of library ?? []) {
      for (const t of d.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
  }, [library]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (library ?? [])
      .filter((d) => {
        if (activeTag && !(d.tags ?? []).includes(activeTag)) return false;
        if (!needle) return true;
        const hay = `${d.title} ${d.description ?? ""} ${(d.tags ?? []).join(" ")}`.toLowerCase();
        return hay.includes(needle);
      })
      // Most recently touched first — filename order is meaningless to a coach.
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.title.localeCompare(b.title));
  }, [library, q, activeTag]);

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2.5">
        <span className="text-sm font-semibold text-zinc-800">Library</span>
        <div className="flex items-center gap-1">
          <button
            title="Trash (restore deleted drills)"
            onClick={() => useEditor.getState().setTrashOpen(true)}
            className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100"
          >
            <ArchiveRestore size={16} />
          </button>
          <button
            title="Team roster"
            onClick={() => setRosterOpen(true)}
            className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100"
          >
            <Users size={16} />
          </button>
          <button
            title="New drill"
            onClick={() => void newDrill()}
            className="flex items-center gap-1 rounded-md bg-blue-800 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-900"
          >
            <Plus size={14} />
            New
          </button>
        </div>
      </div>
      <div className="border-b border-zinc-200 p-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search drills"
            spellCheck={false}
            className="w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-7 pr-2 text-sm outline-none focus:ring-2 focus:ring-blue-700/40"
          />
        </div>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTag(activeTag === t ? null : t)}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  activeTag === t
                    ? "bg-blue-800 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {library === null && <p className="p-2 text-sm text-zinc-500">Loading…</p>}
        {library !== null && filtered.length === 0 && (
          <p className="p-2 text-sm text-zinc-500">
            {library.length === 0 ? "No drills yet — create one!" : "No drills match."}
          </p>
        )}
        {filtered.map((item) => (
          <LibraryCard key={item.id} item={item} />
        ))}
      </div>
    </aside>
  );
}
