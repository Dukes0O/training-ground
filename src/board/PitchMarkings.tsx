import type { PitchSpec } from "../pitch/formats";

const LINE = "#fafafa";
const LW = 0.12;
const GRASS_A = "#4c9a63";
const GRASS_B = "#469059";

export function PitchMarkings({ spec, gridOn }: { spec: PitchSpec; gridOn: boolean }) {
  const { length: L, width: W } = spec;
  const stripeCount = spec.ends === "single" ? 6 : 10;
  const stripeW = L / stripeCount;
  const c = W / 2;
  return (
    <g>
      {Array.from({ length: stripeCount }, (_, i) => (
        <rect
          key={i}
          x={i * stripeW}
          y={0}
          width={stripeW}
          height={W}
          fill={i % 2 === 0 ? GRASS_A : GRASS_B}
        />
      ))}
      {spec.grid && gridOn && <GridLines spec={spec} />}
      <rect x={0} y={0} width={L} height={W} fill="none" stroke={LINE} strokeWidth={LW} />
      {spec.ends === "both" && (
        <g>
          <line x1={L / 2} y1={0} x2={L / 2} y2={W} stroke={LINE} strokeWidth={LW} />
          {spec.centerCircleRadius != null && (
            <circle cx={L / 2} cy={c} r={spec.centerCircleRadius} fill="none" stroke={LINE} strokeWidth={LW} />
          )}
          <circle cx={L / 2} cy={c} r={0.22} fill={LINE} />
        </g>
      )}
      {spec.ends === "single" && (
        <g>
          {spec.centerCircleRadius != null && (
            <path
              d={`M ${L} ${c - spec.centerCircleRadius} A ${spec.centerCircleRadius} ${spec.centerCircleRadius} 0 0 0 ${L} ${c + spec.centerCircleRadius}`}
              fill="none"
              stroke={LINE}
              strokeWidth={LW}
            />
          )}
          <circle cx={L} cy={c} r={0.22} fill={LINE} />
        </g>
      )}
      {spec.ends !== "none" && <EndMarkings spec={spec} />}
      {spec.ends === "both" && (
        <g transform={`translate(${L},0) scale(-1,1)`}>
          <EndMarkings spec={spec} />
        </g>
      )}
      {spec.cornerArcRadius != null && spec.ends === "both" && (
        <CornerArcs L={L} W={W} r={spec.cornerArcRadius} />
      )}
    </g>
  );
}

/** Markings for the left end (x = 0); the right end reuses this mirrored. */
function EndMarkings({ spec }: { spec: PitchSpec }) {
  const c = spec.width / 2;
  const pa = spec.penaltyArea;
  const ga = spec.goalArea;
  const goal = spec.goal;
  return (
    <g>
      {pa && (
        <rect x={0} y={c - pa.width / 2} width={pa.depth} height={pa.width} fill="none" stroke={LINE} strokeWidth={LW} />
      )}
      {ga && (
        <rect x={0} y={c - ga.width / 2} width={ga.depth} height={ga.width} fill="none" stroke={LINE} strokeWidth={LW} />
      )}
      {spec.penaltySpot != null && <circle cx={spec.penaltySpot} cy={c} r={0.22} fill={LINE} />}
      {spec.penaltyArc && pa && spec.penaltySpot != null && spec.centerCircleRadius != null && (
        <PenaltyArc paDepth={pa.depth} spot={spec.penaltySpot} r={spec.centerCircleRadius} c={c} />
      )}
      {goal && (
        <g>
          <rect
            x={-goal.depth}
            y={c - goal.width / 2}
            width={goal.depth}
            height={goal.width}
            fill="rgba(255,255,255,0.22)"
            stroke={LINE}
            strokeWidth={0.1}
          />
          <line
            x1={-goal.depth / 2}
            y1={c - goal.width / 2}
            x2={-goal.depth / 2}
            y2={c + goal.width / 2}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={0.05}
          />
        </g>
      )}
    </g>
  );
}

function PenaltyArc({ paDepth, spot, r, c }: { paDepth: number; spot: number; r: number; c: number }) {
  const dx = paDepth - spot;
  if (dx >= r) return null;
  const half = Math.sqrt(r * r - dx * dx);
  return (
    <path
      d={`M ${paDepth} ${c - half} A ${r} ${r} 0 0 1 ${paDepth} ${c + half}`}
      fill="none"
      stroke={LINE}
      strokeWidth={LW}
    />
  );
}

function CornerArcs({ L, W, r }: { L: number; W: number; r: number }) {
  const d = `M 0 ${r} A ${r} ${r} 0 0 0 ${r} 0`;
  return (
    <g fill="none" stroke={LINE} strokeWidth={LW}>
      <path d={d} />
      <path d={d} transform={`translate(${L},0) scale(-1,1)`} />
      <path d={d} transform={`translate(0,${W}) scale(1,-1)`} />
      <path d={d} transform={`translate(${L},${W}) scale(-1,-1)`} />
    </g>
  );
}

function GridLines({ spec }: { spec: PitchSpec }) {
  const s = spec.grid!.spacing;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = s; x < spec.length; x += s) xs.push(x);
  for (let y = s; y < spec.width; y += s) ys.push(y);
  return (
    <g stroke="rgba(255,255,255,0.25)" strokeWidth={0.06}>
      {xs.map((x) => (
        <line key={`v${x}`} x1={x} y1={0} x2={x} y2={spec.width} />
      ))}
      {ys.map((y) => (
        <line key={`h${y}`} x1={0} y1={y} x2={spec.length} y2={y} />
      ))}
    </g>
  );
}
