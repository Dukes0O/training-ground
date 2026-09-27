import type { ReactNode, Ref } from "react";
import type { Point } from "../model/types";
import type { BoardSnapshot } from "../model/resolve";
import { billboardTransform, getBoardProjection, PITCH_PALETTES, projectedHeading, projectPoint } from "../model/boardCamera";
import { APRON } from "../pitch/formats";
import { PitchMarkings } from "./PitchMarkings";
import { VisionCones } from "./VisionCones";
import { StadiumSurroundings } from "./StadiumSurroundings";
import { PlayerToken } from "./entities/PlayerToken";
import { MiniatureAssetDefs } from "./entities/miniatureAssets";
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
  const projection = getBoardProjection(spec, snapshot.view, snapshot.appearance, snapshot.surroundings, snapshot.playerSize);
  const bounds = snapshot.cameraBounds ?? projection.bounds;
  const labelProjection = { ...projection, bounds };
  const palette = PITCH_PALETTES[snapshot.pitchStyle ?? "grass"];

  const interactive = !!(onBoardPointerDown || onEntityPointerDown);
  const grabFor = (id: string) =>
    onEntityPointerDown
      ? (e: React.PointerEvent<SVGGElement>) => onEntityPointerDown(id, e)
      : undefined;

  const zones = annotations.filter((a) => a.entity.kind === "zone");
  const arrows = annotations.filter((a) => a.entity.kind === "arrow");
  const labels = annotations.filter((a) => {
    if (a.entity.kind !== "label") return false;
    if (!snapshot.cameraBounds || !a.pose) return true;
    const point = projectPoint(projection.matrix, a.pose);
    return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
  });

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
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
      <MiniatureAssetDefs />
      <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill={snapshot.surroundings === "stadium" ? (snapshot.pitchStyle === "light" ? "#cbd4cf" : "#172a32") : palette.apron} />
      <g data-board-world="true" transform={projection.transform}>
      {snapshot.surroundings === "stadium" && <StadiumSurroundings spec={spec} accent={snapshot.stadiumAccent} label={snapshot.stadiumLabel} light={snapshot.pitchStyle === "light"} />}
      <rect x={-APRON} y={-APRON} width={vbW} height={vbH} fill={palette.apron} />
      <PitchMarkings spec={spec} gridOn={gridOn} palette={palette} />
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
      <VisionCones snapshot={snapshot} />
      <g data-motion-trails="true" pointerEvents="none" aria-hidden="true" fill="none" strokeLinecap="butt" strokeLinejoin="round">
        {snapshot.trails?.map((trail) => (
          <g key={trail.id} data-trail-for={trail.id}>
            {trail.segments.map((segment, index) => (
              <g key={index} opacity={segment.opacity}>
                <line x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y}
                  stroke={trail.kind === "ball" ? palette.ballTrail : palette.playerTrail} strokeWidth={(trail.kind === "ball" ? 0.24 : 0.46) * s} />
                {trail.team && <line x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y}
                  stroke={teams[trail.team].fill} strokeWidth={0.17 * s} />}
              </g>
            ))}
          </g>
        ))}
      </g>
      {arrows.map(
        (a) =>
          a.from &&
          a.to && (
            <ArrowGlyph
              key={a.entity.id}
              annotation={{ ...a.entity, color: a.entity.color ?? palette.ink }}
              from={a.from}
              to={a.to}
              scale={s}
              opacity={a.opacity}
              selected={selection?.has(a.entity.id)}
              onPointerDown={grabFor(a.entity.id)}
            />
          )
      )}
      {items.map(({ entity, pose, heading, moving, gaitPhase, playerDisplay }) => {
        const selected = selection?.has(entity.id);
        switch (entity.kind) {
          case "player":
            return (
              <g key={entity.id} transform={billboardTransform(projection, pose)}>
              <PlayerToken
                key={entity.id}
                player={entity}
                pose={pose}
                style={teams[entity.team]}
                heading={projectedHeading(projection, heading ?? 0)}
                moving={moving}
                gaitPhase={gaitPhase}
                appearance={playerDisplay?.appearance ?? snapshot.appearance}
                size={snapshot.playerSize}
                labels={snapshot.playerLabels}
                scale={s}
                selected={selected}
                onPointerDown={grabFor(entity.id)}
              />
              </g>
            );
          case "ball":
            return (
              <g key={entity.id} transform={billboardTransform(projection, pose)}>
              <BallGlyph
                key={entity.id}
                pose={pose}
                appearance={snapshot.appearance}
                scale={s}
                selected={selected}
                onPointerDown={grabFor(entity.id)}
              />
              </g>
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
            <g key={a.entity.id} transform={billboardTransform(projection, a.pose)}>
            <LabelGlyph
              key={a.entity.id}
              projection={labelProjection}
              annotation={{ ...a.entity, color: a.entity.color ?? palette.ink }}
              pose={a.pose}
              scale={s}
              opacity={a.opacity}
              selected={selection?.has(a.entity.id)}
              onPointerDown={grabFor(a.entity.id)}
            />
            </g>
          )
      )}
      {children}
      </g>
    </svg>
  );
}
