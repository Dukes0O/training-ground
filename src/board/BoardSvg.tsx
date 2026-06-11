import type { ReactNode, Ref } from "react";
import type { Point } from "../model/types";
import type { BoardSnapshot } from "../model/resolve";
import { APRON } from "../pitch/formats";
import { PitchMarkings } from "./PitchMarkings";
import { PlayerToken } from "./entities/PlayerToken";
import { BallGlyph } from "./entities/BallGlyph";
import { EquipmentGlyph } from "./entities/EquipmentGlyph";
import { ArrowGlyph } from "./annotations/ArrowGlyph";
import { ZoneGlyph } from "./annotations/ZoneGlyph";
import { LabelGlyph } from "./annotations/LabelGlyph";
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
  /** Editor-only overlay (drag previews, handles) drawn above everything. */
  children?: ReactNode;
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
  children,
}: BoardSvgProps) {
  const { spec, gridOn, teams, items, annotations } = snapshot;
  const vbW = spec.length + 2 * APRON;
  const vbH = spec.width + 2 * APRON;
  const s = spec.tokenScale;

  const interactive = !!(onBoardPointerDown || onEntityPointerDown);
  const grabFor = (id: string) =>
    onEntityPointerDown
      ? (e: React.PointerEvent<SVGGElement>) => onEntityPointerDown(id, e)
      : undefined;

  const zones = annotations.filter((a) => a.entity.kind === "zone");
  const arrows = annotations.filter((a) => a.entity.kind === "arrow");
  const labels = annotations.filter((a) => a.entity.kind === "label");

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
      {zones.map((a) => (
        <ZoneGlyph
          key={a.entity.id}
          annotation={a.entity}
          scale={s}
          opacity={a.opacity}
          selected={selection?.has(a.entity.id)}
          onPointerDown={grabFor(a.entity.id)}
        />
      ))}
      {arrows.map(
        (a) =>
          a.from &&
          a.to && (
            <ArrowGlyph
              key={a.entity.id}
              annotation={a.entity}
              from={a.from}
              to={a.to}
              scale={s}
              opacity={a.opacity}
              selected={selection?.has(a.entity.id)}
              onPointerDown={grabFor(a.entity.id)}
            />
          )
      )}
      {items.map(({ entity, pose }) => {
        const selected = selection?.has(entity.id);
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
                onPointerDown={grabFor(entity.id)}
              />
            );
          case "ball":
            return (
              <BallGlyph
                key={entity.id}
                pose={pose}
                scale={s}
                selected={selected}
                onPointerDown={grabFor(entity.id)}
              />
            );
          case "arrow":
          case "zone":
          case "label":
            return null;
          default:
            return (
              <EquipmentGlyph
                key={entity.id}
                equipment={entity}
                pose={pose}
                scale={s}
                selected={selected}
                onPointerDown={grabFor(entity.id)}
              />
            );
        }
      })}
      {labels.map(
        (a) =>
          a.pose && (
            <LabelGlyph
              key={a.entity.id}
              annotation={a.entity}
              pose={a.pose}
              scale={s}
              opacity={a.opacity}
              selected={selection?.has(a.entity.id)}
              onPointerDown={grabFor(a.entity.id)}
            />
          )
      )}
      {children}
    </svg>
  );
}
