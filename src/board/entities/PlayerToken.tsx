import type { Player, Pose, TeamStyle } from "../../model/types";
import { normalizePlayerSize } from "../../model/playerDisplay";
import { PLAYER_CAPTION_MAX_WIDTH } from "../../model/boardCamera";

interface Props {
  player: Player;
  pose: Pose;
  style: TeamStyle;
  scale: number;
  size?: number;
  labels?: "number-role" | "number" | "hidden";
  appearance?: "miniatures" | "classic";
  heading?: number;
  moving?: boolean;
  gaitPhase?: number;
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
}

export function PlayerToken({ player, pose, style, scale, size, labels = "number-role", selected, onPointerDown, appearance = "miniatures", heading = 0, moving = false, gaitPhase = 0 }: Props) {
  const bodySize = normalizePlayerSize(size);
  const s = scale * bodySize;
  const captionScale = scale * Math.max(bodySize, 0.85);
  const r = 1.2 * s;
  const label = [player.name, player.position].filter(Boolean).join(" · ");
  const title = [player.position, player.number != null ? `number ${player.number}` : "", player.name].filter(Boolean).join(", ");
  if (appearance !== "classic") {
    const role = player.position ?? player.name ?? "";
    const fullCaption = labels === "hidden" ? "" : [player.number, labels === "number-role" ? role : ""].filter(v => v !== undefined && v !== "").join("  ");
    const caption = fullCaption.length > 17 ? `${fullCaption.slice(0, 16)}…` : fullCaption;
    const captionWidth = Math.max(1.8, Math.min(PLAYER_CAPTION_MAX_WIDTH, caption.length * 0.48 + 0.85)) * captionScale;
    const phase = ((gaitPhase % 1) + 1) % 1;
    const facingFlip = Math.cos(heading * Math.PI / 180) < -0.1 ? -1 : 1;
    const bounce = moving ? Math.sin(phase * Math.PI * 2) ** 2 * 0.09 * s : 0;
    return (
      <g transform={`translate(${pose.x} ${pose.y})`} onPointerDown={onPointerDown}
        style={onPointerDown ? { cursor: "grab" } : undefined}>
        <title>{title}</title>
        <ellipse cx={0.18 * s} cy={0.16 * s} rx={1.18 * s} ry={0.5 * s} fill="#0a2015" opacity={0.27} />
        <ellipse rx={1.24 * s} ry={0.53 * s} fill={style.fill} fillOpacity={0.18} stroke={style.fill} strokeOpacity={0.8} strokeWidth={0.12 * s} />
        {selected && <ellipse rx={1.5 * s} ry={0.72 * s} fill="none" stroke="#f3ff9b" strokeWidth={0.19 * s} />}
        <g transform={`translate(0 ${-bounce}) scale(${facingFlip} 1)`} pointerEvents="none">
          <use href={`#tg-miniature-${player.team}-${moving ? "run" : "idle"}`}
            x={-1.8 * s} y={-4.05 * s} width={3.6 * s} height={4.45 * s} />
        </g>
        {caption && <g pointerEvents="none">
          <rect x={-captionWidth / 2} y={0.69 * s} width={captionWidth} height={1.17 * captionScale} rx={0.38 * captionScale}
            fill="#122e26" fillOpacity={0.94} stroke="#dce9da" strokeOpacity={0.28} strokeWidth={0.07 * captionScale}/>
          <rect x={-captionWidth / 2} y={0.69 * s + 0.24 * captionScale} width={0.13 * captionScale} height={0.66 * captionScale} rx={0.04 * captionScale} fill={style.fill}/>
          <text x={0} y={0.69 * s + 0.61 * captionScale} fontSize={0.78 * captionScale} fontWeight={700} fill="#ffffff" textAnchor="middle" dominantBaseline="central"
            textLength={caption.length > 10 ? Math.min(captionWidth - 0.5 * captionScale, (PLAYER_CAPTION_MAX_WIDTH - 0.95) * captionScale) : undefined} lengthAdjust="spacingAndGlyphs">{caption}</text>
        </g>}
        <rect x={-Math.max(3.6 * s, caption ? captionWidth : 0) / 2} y={-4.05 * s} width={Math.max(3.6 * s, caption ? captionWidth : 0)} height={4.74 * s + 1.17 * captionScale} fill="transparent" />
      </g>
    );
  }
  return (
    <g
      transform={`translate(${pose.x} ${pose.y})`}
      onPointerDown={onPointerDown}
      style={onPointerDown ? { cursor: "grab" } : undefined}
    >
      <title>{title}</title>
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
      {labels !== "hidden" && player.number != null && (
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
      {labels === "number-role" && label && (
        <text
          y={r + 0.95 * s}
          fontSize={0.85 * captionScale}
          fontWeight={600}
          fill="#ffffff"
          stroke="rgba(20,40,25,0.6)"
          strokeWidth={0.16 * captionScale}
          paintOrder="stroke"
          textAnchor="middle"
          dominantBaseline="central"
          textLength={label.length > 10 ? (PLAYER_CAPTION_MAX_WIDTH - 0.95) * captionScale : undefined}
          lengthAdjust="spacingAndGlyphs"
        >
          {label.length > 17 ? `${label.slice(0, 16)}…` : label}
        </text>
      )}
    </g>
  );
}
