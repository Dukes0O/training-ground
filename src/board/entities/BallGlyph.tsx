import type { Pose } from "../../model/types";

interface Props {
  pose: Pose;
  scale: number;
  appearance?: "miniatures" | "classic";
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

export function BallGlyph({ pose, scale: s, selected, onPointerDown, appearance = "miniatures" }: Props) {
  const r = 0.55 * s;
  if (appearance !== "classic") return (
    <g transform={`translate(${pose.x} ${pose.y})`} onPointerDown={onPointerDown}
      style={onPointerDown ? { cursor: "grab" } : undefined}>
      <title>Ball</title>
      <ellipse cx={0.18*s} cy={0.32*s} rx={0.66*s} ry={0.31*s} fill="#0c2416" opacity={0.38}/>
      {selected && <circle r={r+0.36*s} fill="none" stroke="#f3ff9b" strokeWidth={0.14*s}/>}
      <circle r={r*1.05} fill="url(#tg-ball-leather)" stroke="#edf4e9" strokeWidth={0.05*s}/>
      <g transform={`rotate(${pose.rotation ?? 15})`}>
        <polygon points={pentagonPoints(r*0.4)} fill="#213239" stroke="#111e25" strokeWidth={0.03*s}/>
        {Array.from({length:5},(_,i)=>(<g key={i} transform={`rotate(${i*72})`}>
          <path d={`M 0 ${-r*0.4} L ${r*0.28} ${-r*0.78} L ${r*0.16} ${-r*0.99}`} fill="none" stroke="#75827e" strokeWidth={0.035*s}/>
          <path d={`M ${r*0.16} ${-r*0.99} L ${r*0.43} ${-r*0.87} L ${r*0.36} ${-r*0.69} L ${r*0.11} ${-r*0.72} Z`} fill="#26363c"/>
        </g>))}
      </g>
      <circle r={r*1.05} fill="url(#tg-ball-light)"/>
      <ellipse cx={-r*0.28} cy={-r*0.34} rx={r*0.21} ry={r*0.13} fill="#ffffff" opacity={0.7}/>
      <circle r={r*1.85} fill="transparent"/>
    </g>
  );
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
