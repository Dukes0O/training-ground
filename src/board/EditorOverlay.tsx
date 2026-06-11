import type { BoardSnapshot } from "../model/resolve";
import type { DrawPreview } from "./useBoardInteraction";
import { ArrowGlyph } from "./annotations/ArrowGlyph";
import { ZoneGlyph } from "./annotations/ZoneGlyph";

interface Props {
  snapshot: BoardSnapshot;
  selection: ReadonlySet<string>;
  preview: DrawPreview | null;
  onHandlePointerDown: (
    drag: { kind: "arrow-end"; id: string; which: "from" | "to" } | { kind: "zone-resize"; id: string },
    e: React.PointerEvent<SVGElement>
  ) => void;
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
