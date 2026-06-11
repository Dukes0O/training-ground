import type { Equipment, Pose } from "../../model/types";

export const EQUIPMENT_DEFAULT_COLORS: Record<string, string> = {
  cone: "#f97316",
  flat: "#facc15",
  minigoal: "#e4e4e7",
  ladder: "#e4e4e7",
  mannequin: "#2563eb",
  pole: "#f87171",
  hurdle: "#e4e4e7",
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  cone: "Cone",
  flat: "Flat marker",
  minigoal: "Mini goal",
  ladder: "Agility ladder",
  mannequin: "Mannequin",
  pole: "Pole",
  hurdle: "Hurdle",
};

interface Props {
  equipment: Equipment;
  pose: Pose;
  scale: number;
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
}

function Shape({ kind, color, s }: { kind: Equipment["kind"]; color: string; s: number }) {
  const outline = "rgba(0,0,0,0.35)";
  switch (kind) {
    case "cone": {
      const h = 1.0 * s;
      return (
        <>
          <rect x={-0.52 * h} y={0.3 * h} width={1.04 * h} height={0.18 * h} rx={0.09 * h} fill={color} opacity={0.75} />
          <polygon
            points={`0,${-0.52 * h} ${0.36 * h},${0.34 * h} ${-0.36 * h},${0.34 * h}`}
            fill={color}
            stroke={outline}
            strokeWidth={0.05 * s}
            strokeLinejoin="round"
          />
          <line x1={-0.2 * h} y1={-0.05 * h} x2={0.2 * h} y2={-0.05 * h} stroke="rgba(255,255,255,0.85)" strokeWidth={0.1 * h} />
        </>
      );
    }
    case "flat":
      return (
        <ellipse rx={0.55 * s} ry={0.55 * s} fill={color} stroke={outline} strokeWidth={0.06 * s}>
          <title>flat marker</title>
        </ellipse>
      );
    case "minigoal": {
      const w = 2.4 * s;
      const d = 0.8 * s;
      return (
        <>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="rgba(255,255,255,0.25)" stroke={color} strokeWidth={0.14 * s} />
          <line x1={-w / 2} y1={d / 2} x2={w / 2} y2={d / 2} stroke={color} strokeWidth={0.2 * s} />
          <line x1={-w / 2 + 0.3 * s} y1={-d / 2} x2={-w / 2 + 0.3 * s} y2={d / 2} stroke="rgba(255,255,255,0.5)" strokeWidth={0.05 * s} />
          <line x1={w / 2 - 0.3 * s} y1={-d / 2} x2={w / 2 - 0.3 * s} y2={d / 2} stroke="rgba(255,255,255,0.5)" strokeWidth={0.05 * s} />
        </>
      );
    }
    case "ladder": {
      const w = 1.1 * s;
      const len = 3.2 * s;
      const rungs = 5;
      return (
        <g stroke={color} strokeWidth={0.09 * s}>
          <line x1={-len / 2} y1={-w / 2} x2={len / 2} y2={-w / 2} />
          <line x1={-len / 2} y1={w / 2} x2={len / 2} y2={w / 2} />
          {Array.from({ length: rungs + 1 }, (_, i) => {
            const x = -len / 2 + (len / rungs) * i;
            return <line key={i} x1={x} y1={-w / 2} x2={x} y2={w / 2} />;
          })}
        </g>
      );
    }
    case "mannequin":
      return (
        <>
          <circle r={0.55 * s} fill={color} stroke={outline} strokeWidth={0.06 * s} />
          <circle r={0.24 * s} fill="rgba(255,255,255,0.85)" />
          <line x1={-0.75 * s} y1={0} x2={0.75 * s} y2={0} stroke={color} strokeWidth={0.16 * s} strokeLinecap="round" />
        </>
      );
    case "pole":
      return (
        <>
          <circle r={0.3 * s} fill={color} stroke={outline} strokeWidth={0.06 * s} />
          <circle r={0.1 * s} fill="rgba(255,255,255,0.9)" />
        </>
      );
    case "hurdle":
      return (
        <>
          <rect x={-0.9 * s} y={-0.12 * s} width={1.8 * s} height={0.24 * s} rx={0.1 * s} fill={color} stroke={outline} strokeWidth={0.05 * s} />
          <circle cx={-0.8 * s} cy={0.3 * s} r={0.12 * s} fill={color} />
          <circle cx={0.8 * s} cy={0.3 * s} r={0.12 * s} fill={color} />
        </>
      );
  }
}

export function EquipmentGlyph({ equipment, pose, scale: s, selected, onPointerDown }: Props) {
  const color = equipment.color ?? EQUIPMENT_DEFAULT_COLORS[equipment.kind] ?? "#e4e4e7";
  const big = equipment.kind === "minigoal" || equipment.kind === "ladder";
  return (
    <g
      transform={`translate(${pose.x} ${pose.y})${pose.rotation ? ` rotate(${pose.rotation})` : ""}`}
      onPointerDown={onPointerDown}
      style={onPointerDown ? { cursor: "grab" } : undefined}
    >
      <circle r={(big ? 1.9 : 1.0) * s} fill="transparent" />
      {selected && (
        <circle
          r={(big ? 2.0 : 1.05) * s}
          fill="none"
          stroke="#ffffff"
          strokeWidth={0.1 * s}
          strokeDasharray={`${0.4 * s} ${0.28 * s}`}
        />
      )}
      <Shape kind={equipment.kind} color={color} s={s} />
    </g>
  );
}
