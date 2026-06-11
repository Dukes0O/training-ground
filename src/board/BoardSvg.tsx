import type { Ref } from "react";
import type { Point } from "../model/types";
import type { BoardSnapshot } from "../model/resolve";
import { APRON } from "../pitch/formats";
import { PitchMarkings } from "./PitchMarkings";
import { PlayerToken } from "./entities/PlayerToken";
import { BallGlyph } from "./entities/BallGlyph";
import { ConeGlyph } from "./entities/ConeGlyph";
import { svgPoint } from "./svgPoint";

export interface BoardSvgProps {
  snapshot: BoardSnapshot;
  /** Explicit pixel size (export). Omit to fill the container. */
  width?: number;
  height?: number;
  selection?: ReadonlySet<string>;
  onEntityPointerDown?: (id: string, e: React.PointerEvent<SVGGElement>) => void;
  onBoardPointerDown?: (pt: Point, e: React.PointerEvent<SVGSVGElement>) => void;
  onBoardPointerMove?: (pt: Point, e: React.PointerEvent<SVGSVGElement>) => void;
  onBoardPointerUp?: (pt: Point, e: React.PointerEvent<SVGSVGElement>) => void;
  svgRef?: Ref<SVGSVGElement>;
  className?: string;
}

/**
 * Pure board renderer — the single draw path shared by the live editor and
 * every export (PNG/video/GIF rasterize this exact component). Keep it free of
 * external refs, webfonts and foreignObject so SVG-to-canvas stays clean.
 */
export function BoardSvg({
  snapshot,
  width,
  height,
  selection,
  onEntityPointerDown,
  onBoardPointerDown,
  onBoardPointerMove,
  onBoardPointerUp,
  svgRef,
  className,
}: BoardSvgProps) {
  const { spec, gridOn, teams, items } = snapshot;
  const vbW = spec.length + 2 * APRON;
  const vbH = spec.width + 2 * APRON;
  const s = spec.tokenScale;

  const interactive = !!(onBoardPointerDown || onEntityPointerDown);

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${-APRON} ${-APRON} ${vbW} ${vbH}`}
      width={width ?? "100%"}
      height={height ?? "100%"}
      preserveAspectRatio="xMidYMid meet"
      fontFamily='"Segoe UI", system-ui, sans-serif'
      style={interactive ? { touchAction: "none", display: "block" } : { display: "block" }}
      className={className}
      onPointerDown={
        onBoardPointerDown &&
        ((e) => onBoardPointerDown(svgPoint(e.currentTarget, e.clientX, e.clientY), e))
      }
      onPointerMove={
        onBoardPointerMove &&
        ((e) => onBoardPointerMove(svgPoint(e.currentTarget, e.clientX, e.clientY), e))
      }
      onPointerUp={
        onBoardPointerUp &&
        ((e) => onBoardPointerUp(svgPoint(e.currentTarget, e.clientX, e.clientY), e))
      }
      onPointerCancel={
        onBoardPointerUp &&
        ((e) => onBoardPointerUp(svgPoint(e.currentTarget, e.clientX, e.clientY), e))
      }
    >
      <rect x={-APRON} y={-APRON} width={vbW} height={vbH} fill="#3e7d50" />
      <PitchMarkings spec={spec} gridOn={gridOn} />
      {items.map(({ entity, pose }) => {
        const selected = selection?.has(entity.id);
        const grab = onEntityPointerDown
          ? (e: React.PointerEvent<SVGGElement>) => onEntityPointerDown(entity.id, e)
          : undefined;
        switch (entity.kind) {
          case "player":
            return (
              <PlayerToken
                key={entity.id}
                player={entity}
                pose={pose}
                style={teams[entity.team]}
                scale={s}
                selected={selected}
                onPointerDown={grab}
              />
            );
          case "ball":
            return (
              <BallGlyph key={entity.id} pose={pose} scale={s} selected={selected} onPointerDown={grab} />
            );
          case "cone":
            return (
              <ConeGlyph
                key={entity.id}
                equipment={entity}
                pose={pose}
                scale={s}
                selected={selected}
                onPointerDown={grab}
              />
            );
          default:
            return null;
        }
      })}
    </svg>
  );
}
