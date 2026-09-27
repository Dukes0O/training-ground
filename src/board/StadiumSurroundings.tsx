import type { PitchSpec } from "../pitch/formats";
import { STADIUM_MARGIN } from "../model/boardCamera";

interface Props {
  spec: PitchSpec;
  accent?: string;
  label?: string;
  light?: boolean;
}

/** Original SVG stadium dressing. It shares the pitch projection and exports offline. */
export function StadiumSurroundings({ spec, accent = "#406a84", label = "TRAINING GROUND", light = false }: Props) {
  const { length: l, width: w } = spec;
  const m = STADIUM_MARGIN;
  const seat = /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#406a84";
  const copy = label.trim().slice(0, 40);
  const platform = light ? "#b7c4c6" : "#263941";
  const riser = light ? "#dae1df" : "#344b55";

  const stand = (key: string, transform: string, span: number) => (
    <g key={key} transform={transform}>
      <rect x={0} y={0} width={span} height={4.5} rx={0.45} fill={platform} stroke="#071c2650" strokeWidth={0.25} />
      {[0, 1, 2, 3].map((row) => <g key={row}>
        <rect x={0.5} y={0.55 + row * 0.9} width={span - 1} height={0.62} rx={0.2} fill={seat} opacity={0.55 + row * 0.12} />
        <line x1={0.5} x2={span - 0.5} y1={1.22 + row * 0.9} y2={1.22 + row * 0.9} stroke={riser} strokeWidth={0.1} />
        {Array.from({ length: Math.max(1, Math.floor((span - 2) / 1.3)) }, (_, index) => <line key={index}
          x1={1.1 + index * 1.3} x2={1.1 + index * 1.3} y1={0.56 + row * 0.9} y2={1.15 + row * 0.9}
          stroke="#d7ebee" strokeOpacity={0.16} strokeWidth={0.11} />)}
      </g>)}
      {[0.25, 0.5, 0.75].map((fraction) => <rect key={fraction} x={span * fraction - 0.35} y={0.3} width={0.7} height={3.95} fill={platform} />)}
    </g>
  );

  return <g data-stadium-surrounds="true" pointerEvents="none" aria-hidden="true">
    <rect x={-m} y={-m} width={l + 2 * m} height={w + 2 * m} rx={3} fill={light ? "#cbd4cf" : "#172a32"} />
    <rect x={-4} y={-4} width={l + 8} height={w + 8} rx={1.2} fill={light ? "#a6b2ac" : "#34483f"} />
    {stand("north", `translate(-3 -8.4)`, l + 6)}
    {stand("south", `translate(${l + 3} ${w + 8.4}) rotate(180)`, l + 6)}
    {stand("west", `translate(-8.4 ${w + 2.8}) rotate(-90)`, w + 5.6)}
    {stand("east", `translate(${l + 8.4} -2.8) rotate(90)`, w + 5.6)}
    {[-1, 1].map((side) => {
      const y = side < 0 ? -3.85 : w + 3.05;
      return <g key={side}>
        <rect x={l * 0.15} y={y} width={l * 0.7} height={0.8} rx={0.12} fill="#e8f0e8" />
        {copy && <text x={l / 2} y={y + 0.42} fontSize={Math.min(0.61, l * 0.55 / Math.max(copy.length, 1))} fontWeight={700}
          letterSpacing={0.12} textAnchor="middle" dominantBaseline="central" fill="#224136">{copy}</text>}
      </g>;
    })}
    {[[-5.9, -5.9], [l + 5.9, -5.9], [-5.9, w + 5.9], [l + 5.9, w + 5.9]].map(([x, y], index) => <g key={index} transform={`translate(${x} ${y})`}>
      <rect x={-0.85} y={-0.85} width={1.7} height={1.7} rx={0.25} fill="#50646b" />
      <rect x={-0.52} y={-0.5} width={1.04} height={1} rx={0.15} fill="#e5efd2" opacity={0.8} />
      <line x1={-0.85} y1={0} x2={0.85} y2={0} stroke="#2c444c" strokeWidth={0.15} />
    </g>)}
  </g>;
}
