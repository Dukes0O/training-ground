import type { Equipment, Pose } from "../../model/types";

interface Props {
  equipment: Equipment;
  pose: Pose;
  scale: number;
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
}

export const CONE_DEFAULT_COLOR = "#f97316";

export function ConeGlyph({ equipment, pose, scale: s, selected, onPointerDown }: Props) {
  const h = 1.0 * s;
  const color = equipment.color ?? CONE_DEFAULT_COLOR;
  return (
    <g
      transform={`translate(${pose.x} ${pose.y})`}
      onPointerDown={onPointerDown}
      style={onPointerDown ? { cursor: "grab" } : undefined}
    >
      <circle r={h * 0.9} fill="transparent" />
      {selected && (
        <circle
          r={h * 0.85}
          fill="none"
          stroke="#ffffff"
          strokeWidth={0.1 * s}
          strokeDasharray={`${0.4 * s} ${0.28 * s}`}
        />
      )}
      <rect x={-0.52 * h} y={0.3 * h} width={1.04 * h} height={0.18 * h} rx={0.09 * h} fill={color} opacity={0.75} />
      <polygon
        points={`0,${-0.52 * h} ${0.36 * h},${0.34 * h} ${-0.36 * h},${0.34 * h}`}
        fill={color}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth={0.05 * s}
        strokeLinejoin="round"
      />
      <line x1={-0.2 * h} y1={-0.05 * h} x2={0.2 * h} y2={-0.05 * h} stroke="rgba(255,255,255,0.85)" strokeWidth={0.1 * h} />
    </g>
  );
}
