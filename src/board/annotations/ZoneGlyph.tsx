import type { Annotation } from "../../model/types";

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
  const rect = annotation.rect;
  if (!rect) return null;
  const color = annotation.color ?? DEFAULT_ZONE_COLOR;
  return (
    <g
      opacity={opacity * (preview ? 0.75 : 1)}
      onPointerDown={onPointerDown}
      style={onPointerDown ? { cursor: "move" } : undefined}
    >
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        fill={color}
        fillOpacity={0.16}
        stroke={color}
        strokeOpacity={0.85}
        strokeWidth={0.14 * s}
        strokeDasharray={`${0.8 * s} ${0.5 * s}`}
        rx={0.3}
      />
      {annotation.text && (
        <text
          x={rect.x + 0.5 * s}
          y={rect.y + 1.1 * s}
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
