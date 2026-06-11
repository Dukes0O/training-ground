import type { Player, Pose, TeamStyle } from "../../model/types";

interface Props {
  player: Player;
  pose: Pose;
  style: TeamStyle;
  scale: number;
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
}

export function PlayerToken({ player, pose, style, scale: s, selected, onPointerDown }: Props) {
  const r = 1.2 * s;
  const label = [player.name, player.position].filter(Boolean).join(" · ");
  return (
    <g
      transform={`translate(${pose.x} ${pose.y})`}
      onPointerDown={onPointerDown}
      style={onPointerDown ? { cursor: "grab" } : undefined}
    >
      <circle r={r * 1.5} fill="transparent" />
      {selected && (
        <circle
          r={r + 0.42 * s}
          fill="none"
          stroke="#ffffff"
          strokeWidth={0.12 * s}
          strokeDasharray={`${0.5 * s} ${0.32 * s}`}
          opacity={0.95}
        />
      )}
      <circle r={r} fill={style.fill} stroke="rgba(255,255,255,0.92)" strokeWidth={0.14 * s} />
      {player.number != null && (
        <text
          fontSize={1.25 * s}
          fontWeight={700}
          fill={style.text}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {player.number}
        </text>
      )}
      {label && (
        <text
          y={r + 0.95 * s}
          fontSize={0.85 * s}
          fontWeight={600}
          fill="#ffffff"
          stroke="rgba(20,40,25,0.6)"
          strokeWidth={0.16 * s}
          paintOrder="stroke"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {label}
        </text>
      )}
    </g>
  );
}
