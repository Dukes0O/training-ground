import type { BoardSnapshot } from "../model/resolve";
import { posesAtStep } from "../model/resolve";
import type { DrawPreview } from "./useBoardInteraction";
import { ArrowGlyph } from "./annotations/ArrowGlyph";
import { ZoneGlyph } from "./annotations/ZoneGlyph";
import { useEditor } from "../state/store";

interface Props {
  snapshot: BoardSnapshot;
  selection: ReadonlySet<string>;
  preview: DrawPreview | null;
  onHandlePointerDown: (
    drag: { kind: "arrow-end"; id: string; which: "from" | "to" } | { kind: "zone-resize"; id: string },
    e: React.PointerEvent<SVGElement>
  ) => void;
}

/**
 * Amber dot on the pieces that MOVE into the current step (pose differs from
 * the previous step) — at a glance the coach sees who's active in this phase.
 */
function KeyframeBadges({ snapshot }: { snapshot: BoardSnapshot }) {
  const currentStep = useEditor((st) => st.currentStep);
  const drill = useEditor((st) => st.drill);
  if (currentStep === 0) return null; // the setup picture has no "movers"
  const before = posesAtStep(drill, currentStep - 1);
  const s = snapshot.spec.tokenScale;
  const moved = snapshot.items.filter(({ entity, pose }) => {
    const prev = before.get(entity.id);
    if (!prev) return true; // enters on this step
    return Math.abs(prev.x - pose.x) > 0.01 || Math.abs(prev.y - pose.y) > 0.01;
  });
  return (
    <g pointerEvents="none">
      {moved.map(({ entity, pose }) => (
        <circle
          key={`kf-${entity.id}`}
          cx={pose.x + 1.35 * s}
          cy={pose.y - 1.35 * s}
          r={0.32 * s}
          fill="#f59e0b"
          stroke="rgba(0,0,0,0.4)"
          strokeWidth={0.06 * s}
        />
      ))}
    </g>
  );
}

/** Editor-only chrome drawn above the board: draw previews and drag handles. */
export function EditorOverlay({ snapshot, selection, preview, onHandlePointerDown }: Props) {
  const s = snapshot.spec.tokenScale;
  const selectedId = selection.size === 1 ? [...selection][0] : null;
  const selected = selectedId
    ? snapshot.annotations.find((a) => a.entity.id === selectedId)
    : null;

  return (
    <g>
      <KeyframeBadges snapshot={snapshot} />
      {preview?.kind === "marquee" && (
        <rect
          x={Math.min(preview.from.x, preview.to.x)}
          y={Math.min(preview.from.y, preview.to.y)}
          width={Math.abs(preview.to.x - preview.from.x)}
          height={Math.abs(preview.to.y - preview.from.y)}
          fill="rgba(59,130,246,0.12)"
          stroke="#3b82f6"
          strokeWidth={0.12 * s}
          strokeDasharray={`${0.6 * s} ${0.4 * s}`}
        />
      )}
      {preview?.kind === "arrow" && preview.style && (
        <ArrowGlyph
          annotation={{ kind: "arrow", id: "__preview", style: preview.style }}
          from={preview.from}
          to={preview.to}
          scale={s}
          preview
        />
      )}
      {preview?.kind === "zone" && (
        <ZoneGlyph
          annotation={{
            kind: "zone",
            id: "__preview",
            rect: {
              x: Math.min(preview.from.x, preview.to.x),
              y: Math.min(preview.from.y, preview.to.y),
              w: Math.max(Math.abs(preview.to.x - preview.from.x), 0.5),
              h: Math.max(Math.abs(preview.to.y - preview.from.y), 0.5),
            },
          }}
          scale={s}
          preview
        />
      )}
      {selected?.entity.kind === "arrow" && selected.from && selected.to && (
        <g>
          {(["from", "to"] as const).map((which) => {
            const p = which === "from" ? selected.from! : selected.to!;
            const anchored = selected.entity[which] && "ref" in (selected.entity[which] as object);
            return (
              <circle
                key={which}
                cx={p.x}
                cy={p.y}
                r={0.55 * s}
                fill={anchored ? "#3b82f6" : "#ffffff"}
                stroke={anchored ? "#ffffff" : "#3b82f6"}
                strokeWidth={0.12 * s}
                style={{ cursor: "crosshair" }}
                onPointerDown={(e) => onHandlePointerDown({ kind: "arrow-end", id: selected.entity.id, which }, e)}
              />
            );
          })}
        </g>
      )}
      {selected?.entity.kind === "zone" && selected.entity.rect && (
        <rect
          x={selected.entity.rect.x + selected.entity.rect.w - 0.45 * s}
          y={selected.entity.rect.y + selected.entity.rect.h - 0.45 * s}
          width={0.9 * s}
          height={0.9 * s}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={0.12 * s}
          style={{ cursor: "nwse-resize" }}
          onPointerDown={(e) => onHandlePointerDown({ kind: "zone-resize", id: selected.entity.id }, e)}
        />
      )}
    </g>
  );
}
