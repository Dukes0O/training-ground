import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Clock3,
  Copy,
  Layers3,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { api } from "../api/client";
import type { DrillSummary } from "../api/client";

import { BoardSvg } from "../board/BoardSvg";
import { parseDrill } from "../model/schema";
import { getTimeline, snapshotAtStep } from "../model/resolve";
import type { Drill } from "../model/types";
import { defaultGridOn } from "../pitch/formats";
import { useEditor } from "../state/store";

// A refreshed summary is also a fresh preview key: agents can change files
// without changing server-owned rev/updatedAt fields.
const previewCache = new WeakMap<DrillSummary, Drill>();
function usePreviewDrill(item: DrillSummary) {
  const [result, setResult] = useState<{
    item: DrillSummary;
    value: Drill | "error";
  } | null>(null);
  useEffect(() => {
    if (item.invalid || previewCache.has(item)) return;
    let alive = true;
    api
      .getDrill(item.id)
      .then((raw) => {
        const drill = parseDrill(raw);
        previewCache.set(item, drill);
        if (alive) setResult({ item, value: drill });
      })
      .catch(() => {
        if (alive) setResult({ item, value: "error" });
      });
    return () => {
      alive = false;
    };
  }, [item]);
  return item.invalid
    ? "error"
    : (previewCache.get(item) ?? (result?.item === item ? result.value : null));
}
export function DrillPreview({ drill }: { drill: Drill | "error" | null }) {
  return (
    <div className="drill-preview" aria-hidden="true">
      {drill === "error" ? (
        <AlertTriangle size={24} />
      ) : drill ? (
        <BoardSvg
          snapshot={snapshotAtStep(drill, 0, defaultGridOn(drill.pitch))}
        />
      ) : (
        <span className="preview-loading">Loading board…</span>
      )}
    </div>
  );
}
function LibraryCard({
  item,
  saved,
  onSave,
  onOpen,
  onDuplicate,
  onTrash,
}: {
  item: DrillSummary;
  saved: boolean;
  onSave: () => void;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onTrash: (id: string) => void;
}) {
  const fetched = usePreviewDrill(item);
  const live = useEditor((s) => (s.drillId === item.id ? s.drill : null));
  const drill = live ?? fetched;
  const valid = drill && drill !== "error" ? drill : null;
  const players = valid?.entities.filter((e) => e.kind === "player").length;
  const seconds = valid ? Math.round(getTimeline(valid).totalMs / 1000) : null;
  return (
    <article className="drill-card">
      <button
        className="drill-card-open"
        onClick={() => onOpen(item.id)}
        disabled={item.invalid}
        aria-label={`Open ${item.title}`}
      >
        <DrillPreview drill={drill} />
        <div className="drill-card-copy">
          <div className="drill-tags">
            {(item.tags ?? []).slice(0, 2).map((t) => (
              <span key={t}>{t.replaceAll("-", " ")}</span>
            ))}
          </div>
          <h3>{item.title}</h3>
          <p>
            {item.invalid
              ? `This drill needs a repair: ${item.error ?? "invalid file"}`
              : item.description ||
                "A blank canvas for your next coaching idea."}
          </p>
          <div className="drill-card-meta">
            <span>
              <Users size={13} />
              {players ?? "—"} players
            </span>
            <span>
              <Layers3 size={13} />
              {item.stepCount ?? 0} {(item.stepCount ?? 0) === 1 ? "step" : "steps"}
            </span>
            {seconds != null && (
              <span title="Animation length, not practice duration">
                <Clock3 size={13} />
                {seconds}s demo
              </span>
            )}
          </div>
        </div>
      </button>
      <button
        className={`card-bookmark ${saved ? "is-saved" : ""}`}
        onClick={onSave}
        aria-label={`${saved ? "Unsave" : "Save"} ${item.title}`}
        aria-pressed={saved}
        title={saved ? "Remove from saved drills" : "Save for later"}
      >
        <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="drill-card-footer">
        <button onClick={() => onOpen(item.id)} disabled={item.invalid}>
          Open drill <ArrowRight size={14} />
        </button>
        <div>
          <button
            aria-label={`Duplicate ${item.title}`}
            title="Duplicate drill"
            disabled={item.invalid}
            onClick={() => {
              onDuplicate(item.id);
            }}
          >
            <Copy size={14} />
          </button>
          <button
            aria-label={`Trash ${item.title}`}
            title="Move to trash"
            onClick={() => {
              if (
                window.confirm(
                  `Move “${item.title}” to trash? You can restore it later.`,
                )
              )
                onTrash(item.id);
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
const FAVORITES_KEY = "training-ground.saved-drills";
function readSaved(): string[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(FAVORITES_KEY) ?? "[]",
    );
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}
export function LibraryPanel({
  onOpen,
  onBrief,
  onDuplicate,
  onTrash,
  savedOnly = false,
}: {
  onOpen: (id: string) => void;
  onBrief: () => void;
  onDuplicate: (id: string) => void;
  onTrash: (id: string) => void;
  savedOnly?: boolean;
}) {
  const library = useEditor((s) => s.library);
  const drill = useEditor((s) => s.drill);
  const drillId = useEditor((s) => s.drillId);
  const [q, setQ] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [sort, setSort] = useState("title");
  const [saved, setSaved] = useState(readSaved);
  const tags = useMemo(
    () => [...new Set((library ?? []).flatMap((d) => d.tags ?? []))].sort(),
    [library],
  );
  const primaryTags = [
    "passing",
    "ball mastery",
    "finishing",
    "defending",
    "possession",
    "transition",
  ].filter((t) => tags.includes(t));
  const filtered = useMemo(
    () =>
      (library ?? [])
        .filter(
          (d) =>
            (!savedOnly || saved.includes(d.id)) &&
            (!activeTag || d.tags?.includes(activeTag)) &&
            `${d.title} ${d.description ?? ""} ${(d.tags ?? []).join(" ")}`
              .toLowerCase()
              .includes(q.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sort === "recent"
            ? (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") ||
              a.title.localeCompare(b.title)
            : a.title.localeCompare(b.title),
        ),
    [library, q, activeTag, sort, saved, savedOnly],
  );
  const toggleSaved = (id: string) => {
    const next = saved.includes(id)
      ? saved.filter((v) => v !== id)
      : [...saved, id];
    setSaved(next);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      useEditor
        .getState()
        .addToast(
          "info",
          "Saved for this visit. This browser could not store your saved drills.",
        );
    }
  };
  return (
    <main className="library-page" id="main-content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE COACH’S WORKSPACE</div>
          <h1>
            {savedOnly ? "Your go-to drills." : "Good sessions start here."}
          </h1>
          <p>
            {savedOnly
              ? "Keep your favourites close. Make your next session easier."
              : "Find an idea. Make it yours. Bring it to the pitch."}
          </p>
        </div>
        <span className="library-count">
          <Layers3 size={16} />
          {library?.length ?? "—"} drills in your library
        </span>
      </div>
      {!savedOnly && (
        <section className="library-hero" aria-label="Continue coaching">
          <div className="hero-copy">
            <span className="hero-kicker">
              <span /> FROM THE TACTICS BOARD TO THE TOUCHLINE
            </span>
            <h2>
              A clear plan.
              <br />A confident team.
            </h2>
            <p>
              Turn the moments you want to coach into drills your players can
              see, understand and practise.
            </p>
            <div className="hero-actions">
              <button
                className="button-lime"
                onClick={() => drillId && onOpen(drillId)}
                disabled={!drillId}
              >
                Continue on the board <ArrowRight size={16} />
              </button>
              <button className="hero-brief" onClick={onBrief}>
                <Sparkles size={15} /> Describe a drill
              </button>
            </div>
          </div>
          <div className="hero-board">
            <div className="hero-board-top">
              <span className="live-dot" /> ON YOUR BOARD{" "}
              <span>{drill.steps.length} {drill.steps.length === 1 ? "step" : "steps"}</span>
            </div>
            <DrillPreview drill={drillId ? drill : null} />
            <div className="hero-board-title">
              {drillId ? drill.title : "Loading your workspace…"}
              <ArrowRight size={16} />
            </div>
          </div>
        </section>
      )}
      <section className="library-section" aria-labelledby="library-title">
        <div className="section-heading">
          <div>
            <h2 id="library-title">
              {savedOnly ? "Saved drills" : "Explore the drill library"}
            </h2>
            <p>Animated ideas for purposeful practice.</p>
          </div>
          <label className="sort-label">
            Sort by{" "}
            <select
              aria-label="Sort drills"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="title">Name A–Z</option>
              <option value="recent">Recently updated</option>
            </select>
          </label>
        </div>
        <div className="library-filter-bar">
          <div className="library-search">
            <Search size={17} />
            <input
              aria-label="Search drills"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a skill, drill or coaching idea…"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear search">
                <X size={15} />
              </button>
            )}
          </div>
          <select
            aria-label="Filter by any tag"
            value={activeTag}
            onChange={(e) => setActiveTag(e.target.value)}
          >
            <option value="">All topics</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t.replaceAll("-", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-row">
          <div className="topic-chips">
            {["", ...primaryTags].map((t) => (
              <button
                key={t}
                aria-pressed={activeTag === t}
                className={activeTag === t ? "active" : ""}
                onClick={() => setActiveTag(t)}
              >
                {t ? t.replaceAll("-", " ") : "All drills"}
              </button>
            ))}
          </div>
          <span role="status">
            {filtered.length} {filtered.length === 1 ? "drill" : "drills"}
          </span>
        </div>
        {library === null ? (
          <div className="library-empty">
            <Layers3 size={30} />
            <h3>Loading your drill library…</h3>
            <p>Connecting to the local Training Ground server.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="library-empty">
            <Search size={30} />
            <h3>
              {savedOnly && !q && !activeTag
                ? "Build your shortlist"
                : "No drills found"}
            </h3>
            <p>
              {savedOnly && !q && !activeTag
                ? "Use the bookmark on any drill to save it here."
                : "Try a different skill or clear your filters."}
            </p>
            {(q || activeTag) && (
              <button
                className="button-primary"
                onClick={() => {
                  setQ("");
                  setActiveTag("");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="drill-grid">
            {filtered.map((item) => (
              <LibraryCard
                key={item.id}
                item={item}
                saved={saved.includes(item.id)}
                onSave={() => toggleSaved(item.id)}
                onOpen={onOpen}
                onDuplicate={onDuplicate}
                onTrash={onTrash}
              />
            ))}
          </div>
        )}
      </section>
      <div className="library-footnote">
        <span className="live-dot" /> Your drills live on this computer. Changes
        save automatically.
      </div>
    </main>
  );
}
