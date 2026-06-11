import { useRef, useState } from "react";
import type { AnchorPoint, Annotation, Point } from "../model/types";
import type { BoardSnapshot } from "../model/resolve";
import { posesAtStep } from "../model/resolve";
import { resolvePitch } from "../pitch/formats";
import { useEditor } from "../state/store";

type DragState =
  | { kind: "entity"; id: string; offX: number; offY: number }
  | { kind: "zone-move"; id: string; grab: Point; rect0: { x: number; y: number; w: number; h: number } }
  | { kind: "zone-resize"; id: string; rect0: { x: number; y: number; w: number; h: number } }
  | { kind: "arrow-body"; id: string; grab: Point; from0: Point; to0: Point; via0?: Point[] }
  | { kind: "arrow-end"; id: string; which: "from" | "to" };

export interface DrawPreview {
  kind: "arrow" | "zone";
  style?: "pass" | "run" | "dribble" | "shot";
  from: Point;
  to: Point;
}

function isAnnotation(e: { kind: string } | undefined): e is Annotation {
  return e?.kind === "arrow" || e?.kind === "zone" || e?.kind === "label";
}

/**
 * Pointer state machine for the editing board: drag entities, draw arrows and
 * zones, re-anchor arrow endpoints, resize zones. Pointer capture goes to the
 * <svg> root so moves keep flowing during fast drags.
 */
export function useBoardInteraction(snapshot: BoardSnapshot) {
  const dragRef = useRef<DragState | null>(null);
  const drawRef = useRef<DrawPreview | null>(null);
  const [preview, setPreview] = useState<DrawPreview | null>(null);

  /** Player/ball under the point — for snapping arrow endpoints to anchors. */
  const hitAnchor = (pt: Point): string | null => {
    const state = useEditor.getState();
    const s = resolvePitch(state.drill.pitch).tokenScale;
    const poses = posesAtStep(state.drill, state.currentStep);
    let best: { id: string; d: number } | null = null;
    for (const e of state.drill.entities) {
      if (e.kind !== "player" && e.kind !== "ball") continue;
      const pose = poses.get(e.id);
      if (!pose || pose.hidden) continue;
      const r = (e.kind === "player" ? 1.9 : 1.2) * s;
      const d = Math.hypot(pose.x - pt.x, pose.y - pt.y);
      if (d < r && (!best || d < best.d)) best = { id: e.id, d };
    }
    return best?.id ?? null;
  };

  const anchorOrPoint = (pt: Point): AnchorPoint => {
    const id = hitAnchor(pt);
    return id ? { ref: id } : { x: pt.x, y: pt.y };
  };

  const capture = (e: React.PointerEvent<Element>) => {
    const el = e.currentTarget as Element & { ownerSVGElement?: SVGSVGElement | null };
    const svg = el.ownerSVGElement ?? (el as unknown as SVGSVGElement);
    svg.setPointerCapture?.(e.pointerId);
  };

  const onEntityPointerDown = (id: string, e: React.PointerEvent<SVGGElement>) => {
    if (e.button !== 0) return;
    const state = useEditor.getState();
    if (state.tool !== "select" && !state.tool.startsWith("add-")) return; // drawing tools pass through
    e.stopPropagation();
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const pt = { x: p.x, y: p.y };

    state.select([id], e.shiftKey);
    const entity = state.drill.entities.find((en) => en.id === id);

    if (entity && isAnnotation(entity) && entity.kind === "zone" && entity.rect) {
      dragRef.current = { kind: "zone-move", id, grab: pt, rect0: { ...entity.rect } };
      state.beginGesture();
      svg.setPointerCapture(e.pointerId);
      return;
    }
    if (entity && isAnnotation(entity) && entity.kind === "arrow") {
      // Translate the whole arrow only when both ends are loose points.
      const { from, to } = entity;
      if (from && to && !("ref" in from) && !("ref" in to)) {
        dragRef.current = {
          kind: "arrow-body",
          id,
          grab: pt,
          from0: { x: from.x, y: from.y },
          to0: { x: to.x, y: to.y },
          via0: entity.via?.map((v) => ({ ...v })),
        };
        state.beginGesture();
        svg.setPointerCapture(e.pointerId);
      }
      return; // anchored arrows: select only
    }

    const pose = posesAtStep(state.drill, state.currentStep).get(id);
    if (!pose) return;
    dragRef.current = { kind: "entity", id, offX: pose.x - pt.x, offY: pose.y - pt.y };
    state.beginGesture();
    svg.setPointerCapture(e.pointerId);
  };

  /** Pointer-down on an overlay handle (arrow endpoint / zone corner). */
  const onHandlePointerDown = (
    drag: { kind: "arrow-end"; id: string; which: "from" | "to" } | { kind: "zone-resize"; id: string },
    e: React.PointerEvent<SVGElement>
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const state = useEditor.getState();
    if (drag.kind === "zone-resize") {
      const entity = state.drill.entities.find((en) => en.id === drag.id);
      if (!entity || !isAnnotation(entity) || !entity.rect) return;
      dragRef.current = { kind: "zone-resize", id: drag.id, rect0: { ...entity.rect } };
    } else {
      dragRef.current = drag;
    }
    state.beginGesture();
    capture(e);
  };

  const onBoardPointerDown = (pt: Point, e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const state = useEditor.getState();
    const tool = state.tool;
    switch (tool) {
      case "select":
        state.clearSelection();
        return;
      case "add-home":
        state.addPlayer("home", pt);
        return;
      case "add-away":
        state.addPlayer("away", pt);
        return;
      case "add-neutral":
        state.addPlayer("neutral", pt);
        return;
      case "add-ball":
        state.addBall(pt);
        return;
      case "add-cone":
      case "add-flat":
      case "add-minigoal":
      case "add-ladder":
      case "add-mannequin":
      case "add-pole":
      case "add-hurdle":
        state.addEquipment(tool.slice(4) as never, pt);
        return;
      case "add-label":
        state.addLabel(pt);
        return;
      case "draw-zone": {
        drawRef.current = { kind: "zone", from: pt, to: pt };
        setPreview(drawRef.current);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      case "draw-pass":
      case "draw-run":
      case "draw-dribble":
      case "draw-shot": {
        drawRef.current = { kind: "arrow", style: tool.slice(5) as DrawPreview["style"], from: pt, to: pt };
        setPreview(drawRef.current);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }
  };

  const onBoardPointerMove = (pt: Point) => {
    const state = useEditor.getState();
    const drag = dragRef.current;
    if (drag) {
      switch (drag.kind) {
        case "entity":
          state.moveEntity(drag.id, { x: pt.x + drag.offX, y: pt.y + drag.offY });
          break;
        case "zone-move":
          state.updateAnnotation(drag.id, {
            rect: {
              ...drag.rect0,
              x: drag.rect0.x + (pt.x - drag.grab.x),
              y: drag.rect0.y + (pt.y - drag.grab.y),
            },
          });
          break;
        case "zone-resize":
          state.updateAnnotation(drag.id, {
            rect: {
              x: drag.rect0.x,
              y: drag.rect0.y,
              w: Math.max(1, pt.x - drag.rect0.x),
              h: Math.max(1, pt.y - drag.rect0.y),
            },
          });
          break;
        case "arrow-body": {
          const dx = pt.x - drag.grab.x;
          const dy = pt.y - drag.grab.y;
          state.updateAnnotation(drag.id, {
            from: { x: drag.from0.x + dx, y: drag.from0.y + dy },
            to: { x: drag.to0.x + dx, y: drag.to0.y + dy },
            ...(drag.via0 ? { via: drag.via0.map((v) => ({ x: v.x + dx, y: v.y + dy })) } : {}),
          });
          break;
        }
        case "arrow-end":
          state.updateAnnotation(drag.id, { [drag.which]: anchorOrPoint(pt) });
          break;
      }
      return;
    }
    if (drawRef.current) {
      drawRef.current = { ...drawRef.current, to: pt };
      setPreview(drawRef.current);
    }
  };

  const onBoardPointerUp = (pt: Point) => {
    const state = useEditor.getState();
    if (dragRef.current) {
      dragRef.current = null;
      state.endGesture();
      return;
    }
    const draw = drawRef.current;
    if (draw) {
      drawRef.current = null;
      setPreview(null);
      const len = Math.hypot(pt.x - draw.from.x, pt.y - draw.from.y);
      if (draw.kind === "zone") {
        if (len > 1.5) {
          state.addZone({
            x: Math.min(draw.from.x, pt.x),
            y: Math.min(draw.from.y, pt.y),
            w: Math.max(1, Math.abs(pt.x - draw.from.x)),
            h: Math.max(1, Math.abs(pt.y - draw.from.y)),
          });
        }
      } else if (draw.style && len > 1.2) {
        state.addArrow(draw.style, anchorOrPoint(draw.from), anchorOrPoint(pt));
      }
    }
  };

  return {
    onEntityPointerDown,
    onBoardPointerDown,
    onBoardPointerMove,
    onBoardPointerUp,
    onHandlePointerDown,
    preview,
    snapshot,
  };
}
