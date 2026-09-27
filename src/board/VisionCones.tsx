import type { BoardSnapshot } from "../model/resolve";
import { VISION_CONE_DEGREES, visionBearing } from "../model/vision";

/** SVG-only coaching overlays shared by the board, snapshots and videos. */
export function VisionCones({ snapshot }: { snapshot: BoardSnapshot }) {
  if (!snapshot.vision) return null;
  const scale = snapshot.spec.tokenScale;
  const radius = Math.min(6, Math.max(2, 6 * scale));
  const halfAngle = VISION_CONE_DEGREES * Math.PI / 360;
  const x = radius * Math.cos(halfAngle);
  const y = radius * Math.sin(halfAngle);
  const sector = `M 0 0 L ${x} ${-y} A ${radius} ${radius} 0 0 1 ${x} ${y} Z`;
  const coneColor = snapshot.pitchStyle === "light" ? "#8a661b" : "#fff5ce";

  return (
    <g data-vision-cones="true" pointerEvents="none" aria-hidden="true">
      {snapshot.items.filter(({ entity, pose, playerDisplay }) => entity.kind === "player" && !pose.hidden && (playerDisplay?.vision ?? snapshot.vision)).map((item) => (
        <g
          key={item.entity.id}
          data-vision-for={item.entity.id}
          transform={`translate(${item.pose.x} ${item.pose.y}) rotate(${visionBearing(item, snapshot.timeMs ?? 0, item.playerDisplay?.scan ?? snapshot.scan ?? false)})`}
        >
          <path d={sector} fill={coneColor} fillOpacity={0.12} stroke={coneColor} strokeOpacity={0.32} strokeWidth={0.075 * scale} />
          <line x1={1.15 * scale} y1={0} x2={radius * 0.92} y2={0}
            stroke={coneColor} strokeOpacity={0.48} strokeWidth={0.08 * scale} strokeDasharray={`${0.24 * scale} ${0.24 * scale}`} />
          <circle cx={radius * 0.92} cy={0} r={0.15 * scale} fill={coneColor} fillOpacity={0.85} />
        </g>
      ))}
    </g>
  );
}
