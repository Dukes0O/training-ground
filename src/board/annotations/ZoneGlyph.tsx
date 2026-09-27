import type { Annotation } from "../../model/types";
import { zoneBounds } from "../../model/annotationGeometry";

export const DEFAULT_ZONE_COLOR = "#facc15";

interface Props {
  annotation: Annotation;
  scale: number;
  opacity?: number;
  selected?: boolean;
  preview?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
}

export function ZoneGlyph({ annotation, scale: s, opacity = 1, selected, preview, onPointerDown }: Props) {
  const rect = zoneBounds(annotation);
  if (!rect) return null;
  const color = annotation.color ?? DEFAULT_ZONE_COLOR;
  const ellipse = annotation.shape === "ellipse";
  const polygon = annotation.shape === "polygon";
  const appearance = {
    fill: color,
    fillOpacity: 0.16,
    stroke: color,
    strokeOpacity: 0.85,
    strokeWidth: 0.14 * s,
    strokeDasharray: `${0.8 * s} ${0.5 * s}`,
  };
  return (
    <g
      opacity={opacity * (preview ? 0.75 : 1)}
      onPointerDown={onPointerDown}
      style={onPointerDown ? { cursor: "move" } : undefined}
    >
      {polygon ? (
        <polygon points={annotation.points?.map((point) => `${point.x},${point.y}`).join(" ")} {...appearance} />
      ) : ellipse ? (
        <ellipse cx={rect.x + rect.w / 2} cy={rect.y + rect.h / 2} rx={rect.w / 2} ry={rect.h / 2} {...appearance} />
      ) : (
        <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={0.3} {...appearance} />
      )}
      {annotation.text && (
        <text
          x={ellipse || polygon ? rect.x + rect.w / 2 : rect.x + 0.5 * s}
          y={ellipse || polygon ? rect.y + rect.h / 2 + 0.3 * s : rect.y + 1.1 * s}
          textAnchor={ellipse || polygon ? "middle" : undefined}
          fontSize={0.95 * s}
          fontWeight={600}
          fill="#ffffff"
          stroke="rgba(20,40,25,0.6)"
          strokeWidth={0.14 * s}
          paintOrder="stroke"
        >
          {annotation.text}
        </text>
      )}
      {selected && (
        <rect
          x={rect.x - 0.25}
          y={rect.y - 0.25}
          width={rect.w + 0.5}
          height={rect.h + 0.5}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={0.1 * s}
          strokeDasharray={`${0.5 * s} ${0.35 * s}`}
        />
      )}
    </g>
  );
}
