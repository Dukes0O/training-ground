import type { Annotation, Point } from "../../model/types";
import { samplePath } from "../../model/tween";
import { samplePolyline } from "../../model/annotationGeometry";

export const DEFAULT_ARROW_COLOR = "#ffffff";

interface Props {
  annotation: Annotation;
  from: Point;
  to: Point;
  scale: number;
  opacity?: number;
  selected?: boolean;
  preview?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
}

/** Catmull-Rom chain converted to a smooth cubic-bezier SVG path. */
function smoothPathD(pts: Point[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Sine-offset polyline along the base path — the dribble squiggle. */
function wavyPathD(base: Point[], amp: number, wavelength: number, straight: boolean): string {
  const samples: Point[] = [];
  // Estimate total length to choose sample count.
  let len = 0;
  for (let i = 0; i < base.length - 1; i++) len += Math.hypot(base[i + 1].x - base[i].x, base[i + 1].y - base[i].y);
  const n = Math.max(Math.ceil(len / 0.35), 8);
  const straightTail = Math.min(1.1, len * 0.25); // calm the end so the head reads cleanly
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const sample = straight ? samplePolyline : samplePath;
    const p = sample(base, t);
    const ahead = sample(base, Math.min(t + 0.02, 1));
    const dx = ahead.x - p.x;
    const dy = ahead.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const dist = t * len;
    const damp = Math.min(1, Math.max(0, (len - straightTail - dist) / straightTail + 1));
    const off = Math.sin((dist / wavelength) * Math.PI * 2) * amp * Math.min(damp, 1);
    samples.push({ x: p.x + (-dy / d) * off, y: p.y + (dx / d) * off });
  }
  return `M ${samples.map((p) => `${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(" L ")}`;
}

export function ArrowGlyph({ annotation, from, to, scale: s, opacity = 1, selected, preview, onPointerDown }: Props) {
  const style = annotation.style ?? "plain";
  const color = annotation.color ?? DEFAULT_ARROW_COLOR;
  const pts: Point[] = [from, ...(annotation.via ?? []), to];
  const straight = annotation.pathMode === "straight";

  const thick = style === "shot" ? 0.42 * s : 0.22 * s;
  const headLen = (style === "shot" ? 1.5 : 1.1) * s;
  const headW = (style === "shot" ? 1.2 : 0.9) * s;

  const d =
    style === "dribble" ? wavyPathD(pts, 0.32 * s, 1.7 * s, straight) : straight ? `M ${pts.map((point) => `${point.x} ${point.y}`).join(" L ")}` : smoothPathD(pts);

  // Head alignment from the path's final direction.
  const nearEnd = straight ? [...pts].reverse().find((point) => Math.hypot(point.x - to.x, point.y - to.y) > 0.00001) ?? from : samplePath(pts, 0.96);
  const angle = (Math.atan2(to.y - nearEnd.y, to.x - nearEnd.x) * 180) / Math.PI;

  const dash = style === "run" ? `${0.85 * s} ${0.6 * s}` : undefined;

  return (
    <g
      opacity={opacity * (preview ? 0.75 : 1)}
      onPointerDown={onPointerDown}
      style={onPointerDown ? { cursor: "pointer" } : undefined}
    >
      {/* generous transparent hit area */}
      {onPointerDown && <path d={d} fill="none" stroke="transparent" strokeWidth={1.6 * s} />}
      {/* dark underlay for contrast on grass */}
      <path
        d={d}
        fill="none"
        stroke="rgba(15,35,20,0.4)"
        strokeWidth={thick + 0.14 * s}
        strokeDasharray={dash}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={thick}
        strokeDasharray={dash}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g transform={`translate(${to.x} ${to.y}) rotate(${angle})`}>
        <polygon
          points={`0,0 ${-headLen},${headW / 2} ${-headLen},${-headW / 2}`}
          fill={color}
          stroke="rgba(15,35,20,0.4)"
          strokeWidth={0.07 * s}
          strokeLinejoin="round"
        />
      </g>
      {selected && (
        <path
          d={d}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={0.1 * s}
          strokeDasharray={`${0.5 * s} ${0.35 * s}`}
        />
      )}
    </g>
  );
}
