import type { Pose } from "../../model/types";

interface Props {
  pose: Pose;
  scale: number;
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
}

function pentagonPoints(r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (-90 + i * 72) * (Math.PI / 180);
    pts.push(`${(Math.cos(a) * r).toFixed(3)},${(Math.sin(a) * r).toFixed(3)}`);
  }
  return pts.join(" ");
}

export function BallGlyph({ pose, scale: s, selected, onPointerDown }: Props) {
  const r = 0.55 * s;
  return (
    <g
      transform={`translate(${pose.x} ${pose.y})`}
      onPointerDown={onPointerDown}
      style={onPointerDown ? { cursor: "grab" } : undefined}
    >
      <circle r={r * 1.8} fill="transparent" />
      {selected && (
        <circle
          r={r + 0.35 * s}
          fill="none"
          stroke="#ffffff"
          strokeWidth={0.1 * s}
          strokeDasharray={`${0.4 * s} ${0.28 * s}`}
        />
      )}
      <circle r={r} fill="#ffffff" stroke="#1f2937" strokeWidth={0.08 * s} />
      <polygon points={pentagonPoints(r * 0.45)} fill="#1f2937" />
    </g>
  );
}
