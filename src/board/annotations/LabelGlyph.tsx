import type { Annotation, Pose } from "../../model/types";

export const DEFAULT_LABEL_COLOR = "#ffffff";

interface Props {
  annotation: Annotation;
  pose: Pose;
  scale: number;
  opacity?: number;
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
}

export function LabelGlyph({ annotation, pose, scale: s, opacity = 1, selected, onPointerDown }: Props) {
  const text = annotation.text ?? "";
  const approxW = Math.max(text.length * 0.62 * 1.1 * s, 2 * s);
  return (
    <g
      transform={`translate(${pose.x} ${pose.y})`}
      opacity={opacity}
      onPointerDown={onPointerDown}
      style={onPointerDown ? { cursor: "grab" } : undefined}
    >
      <rect
        x={-approxW / 2 - 0.4 * s}
        y={-0.85 * s}
        width={approxW + 0.8 * s}
        height={1.7 * s}
        rx={0.4 * s}
        fill="transparent"
      />
      {selected && (
        <rect
          x={-approxW / 2 - 0.4 * s}
          y={-0.85 * s}
          width={approxW + 0.8 * s}
          height={1.7 * s}
          rx={0.4 * s}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={0.1 * s}
          strokeDasharray={`${0.5 * s} ${0.35 * s}`}
        />
      )}
      <text
        fontSize={1.1 * s}
        fontWeight={700}
        fill={annotation.color ?? DEFAULT_LABEL_COLOR}
        stroke="rgba(20,40,25,0.65)"
        strokeWidth={0.18 * s}
        paintOrder="stroke"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {text}
      </text>
    </g>
  );
}
