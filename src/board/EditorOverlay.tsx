import type { BoardSnapshot } from "../model/resolve";
import { posesAtStep } from "../model/resolve";
import type { DrawPreview, HandleDrag } from "./useBoardInteraction";
import { zoneBounds } from "../model/annotationGeometry";
import { ArrowGlyph } from "./annotations/ArrowGlyph";
import { ZoneGlyph } from "./annotations/ZoneGlyph";
import { useEditor } from "../state/store";

interface Props {
  snapshot: BoardSnapshot;
  selection: ReadonlySet<string>;
  preview: DrawPreview | null;
  onHandlePointerDown: (
    drag: HandleDrag,
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
  const selectedBounds = selected?.entity.kind === "zone" ? zoneBounds(selected.entity) : undefined;

  return (
    <g>
      <KeyframeBadges snapshot={snapshot} />
      {(preview?.kind === "polygon" || preview?.kind === "polyline") && preview.vertices && (
        <g pointerEvents="none">
          {preview.kind === "polygon" ? <>
            <ZoneGlyph annotation={{ kind: "zone", id: "__draft", shape: "polygon", points: [...preview.vertices, preview.to] }} scale={s} preview />
            <polyline points={[...preview.vertices, preview.to].map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#facc15" strokeWidth={0.15 * s} />
          </> : <ArrowGlyph annotation={{ kind: "arrow", id: "__draft", style: "pass", pathMode: "straight", via: preview.vertices.slice(1) }} from={preview.vertices[0]} to={preview.to} scale={s} preview />}
          {preview.vertices.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={0.35 * s} fill="#ffffff" stroke="#2563eb" strokeWidth={0.1 * s} />)}
        </g>
      )}
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
            shape: preview.shape,
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
          {selected.entity.via?.map((point, index) => <circle key={`via-${index}`} cx={point.x} cy={point.y} r={0.45 * s}
            fill="#facc15" stroke="#2563eb" strokeWidth={0.12 * s} style={{ cursor: "move" }}
            onPointerDown={(event) => onHandlePointerDown({ kind: "arrow-via", id: selected.entity.id, index }, event)} />)}
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
      {selected?.entity.kind === "zone" && selected.entity.shape === "polygon" && selected.entity.points?.map((point, index) => (
        <circle key={`vertex-${index}`} cx={point.x} cy={point.y} r={0.45 * s} fill="#facc15" stroke="#2563eb" strokeWidth={0.12 * s}
          style={{ cursor: "move" }} onPointerDown={(event) => onHandlePointerDown({ kind: "zone-vertex", id: selected.entity.id, index }, event)} />
      ))}
      {selected?.entity.kind === "zone" && selectedBounds && (
        <rect
          x={selectedBounds.x + selectedBounds.w + (selected.entity.shape === "polygon" ? 0.55 : -0.45) * s}
          y={selectedBounds.y + selectedBounds.h + (selected.entity.shape === "polygon" ? 0.55 : -0.45) * s}
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
