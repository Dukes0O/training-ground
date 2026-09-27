import { useEffect, useRef, useState } from "react";
import type { AnchorPoint, Annotation, Point } from "../model/types";
import type { BoardSnapshot } from "../model/resolve";
import { posesAtStep } from "../model/resolve";
import { resolvePitch } from "../pitch/formats";
import { useEditor } from "../state/store";
import { svgPoint } from "./svgPoint";
import { isValidPolygon, resizePolygon, zoneBounds } from "../model/annotationGeometry";

type DragState =
  | { kind: "entity"; id: string; offX: number; offY: number }
  | { kind: "group"; offsets: { id: string; offX: number; offY: number }[] }
  | { kind: "zone-move"; id: string; grab: Point; rect0: { x: number; y: number; w: number; h: number }; points0?: Point[] }
  | { kind: "zone-resize"; id: string; rect0: { x: number; y: number; w: number; h: number }; points0?: Point[] }
  | { kind: "arrow-body"; id: string; grab: Point; from0: Point; to0: Point; via0?: Point[] }
  | { kind: "arrow-end"; id: string; which: "from" | "to" }
  | { kind: "zone-vertex" | "arrow-via"; id: string; index: number };

export type HandleDrag = { kind: "arrow-end"; id: string; which: "from" | "to" } |
  { kind: "zone-resize"; id: string } | { kind: "zone-vertex" | "arrow-via"; id: string; index: number };

export interface DrawPreview {
  kind: "arrow" | "zone" | "marquee" | "polygon" | "polyline";
  style?: "pass" | "run" | "dribble" | "shot";
  shape?: Annotation["shape"];
  vertices?: Point[];
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
  const boardRef = useRef<SVGSVGElement | null>(null);
  const tool = useEditor((state) => state.tool);
  const currentStep = useEditor((state) => state.currentStep);
  const drillId = useEditor((state) => state.drillId);
  const mode = useEditor((state) => state.mode);

  useEffect(() => {
    drawRef.current = null;
    setPreview(null);
  }, [tool, currentStep, drillId, mode]);

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

  const finishDrawing = () => {
    const draw = drawRef.current;
    if (!draw || (draw.kind !== "polygon" && draw.kind !== "polyline")) return;
    const points = draw.vertices ?? [];
    const state = useEditor.getState();
    if (draw.kind === "polygon") {
      if (!isValidPolygon(points)) {
        state.addToast("info", "Add at least three corners around an area without crossing edges. Backspace removes the last corner.");
        return;
      }
      state.addPolygon(points);
    } else {
      if (points.length < 2) {
        state.addToast("info", "Add at least two points to finish the arrow.");
        return;
      }
      state.addArrow("pass", anchorOrPoint(points[0]), anchorOrPoint(points[points.length - 1]), points.slice(1, -1), "straight");
      state.setTool("select");
    }
    drawRef.current = null;
    setPreview(null);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const draw = drawRef.current;
      if (!draw || (draw.kind !== "polygon" && draw.kind !== "polyline")) return;
      const target = event.target instanceof Element ? event.target : null;
      if (event.defaultPrevented || event.isComposing || document.querySelector('dialog[open], [aria-modal="true"]') ||
        target?.closest('input, textarea, select, [contenteditable="true"]') || useEditor.getState().exportJob) return;
      if (!["Enter", "Escape", "Backspace"].includes(event.key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === "Enter") finishDrawing();
      else if (event.key === "Escape") {
        drawRef.current = null;
        setPreview(null);
        useEditor.getState().setTool("select");
      } else {
        const vertices = (draw.vertices ?? []).slice(0, -1);
        drawRef.current = vertices.length ? { ...draw, vertices, from: vertices[0] } : null;
        setPreview(drawRef.current);
      }
    };
    const onDoubleClick = (event: MouseEvent) => {
      if (event.target instanceof Node && boardRef.current?.contains(event.target)) finishDrawing();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("dblclick", onDoubleClick);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("dblclick", onDoubleClick);
    };
  }, []);

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
    const pt = svgPoint(svg, e.clientX, e.clientY);

    // Grabbing a piece that's already part of a multi-selection moves the
    // whole group; anything else selects (shift adds) and drags singly.
    const inSelection = state.selection.includes(id);
    if (inSelection && state.selection.length > 1 && !e.shiftKey) {
      const poses = posesAtStep(state.drill, state.currentStep);
      const annotationKinds = new Set(["arrow", "zone", "label"]);
      const offsets = state.selection
        .filter((sid) => {
          const en = state.drill.entities.find((x) => x.id === sid);
          return en && (!annotationKinds.has(en.kind) || en.kind === "label");
        })
        .map((sid) => {
          const pose = poses.get(sid);
          return pose ? { id: sid, offX: pose.x - pt.x, offY: pose.y - pt.y } : null;
        })
        .filter((o): o is { id: string; offX: number; offY: number } => o !== null);
      if (offsets.length > 0) {
        dragRef.current = { kind: "group", offsets };
        state.beginGesture();
        svg.setPointerCapture(e.pointerId);
        return;
      }
    }
    state.select([id], e.shiftKey);
    const entity = state.drill.entities.find((en) => en.id === id);

    if (entity && isAnnotation(entity) && entity.kind === "zone" && zoneBounds(entity)) {
      dragRef.current = { kind: "zone-move", id, grab: pt, rect0: { ...zoneBounds(entity)! }, points0: entity.shape === "polygon" ? entity.points?.map((point) => ({ ...point })) : undefined };
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
    drag: HandleDrag,
    e: React.PointerEvent<SVGElement>
  ) => {
    if (e.button !== 0) return;
    const state = useEditor.getState();
    if (state.tool !== "select") return;
    e.stopPropagation();
    if (drag.kind === "zone-resize") {
      const entity = state.drill.entities.find((en) => en.id === drag.id);
      if (!entity || !isAnnotation(entity) || !zoneBounds(entity)) return;
      dragRef.current = { kind: "zone-resize", id: drag.id, rect0: { ...zoneBounds(entity)! }, points0: entity.shape === "polygon" ? entity.points?.map((point) => ({ ...point })) : undefined };
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
      case "draw-polygon":
      case "draw-polyline": {
        boardRef.current = e.currentTarget;
        const kind = tool === "draw-polygon" ? "polygon" : "polyline";
        const previous = drawRef.current?.kind === kind ? drawRef.current.vertices ?? [] : [];
        if (!previous.length) state.clearSelection();
        if (kind === "polygon" && previous.length >= 3 && Math.hypot(pt.x - previous[0].x, pt.y - previous[0].y) < 0.35) {
          finishDrawing();
          return;
        }
        const last = previous[previous.length - 1];
        const vertices = last && Math.hypot(last.x - pt.x, last.y - pt.y) < 0.1 ? previous : [...previous, pt];
        drawRef.current = { kind, from: vertices[0], to: pt, vertices };
        setPreview(drawRef.current);
        return;
      }
      case "select": {
        // Drag on empty pitch = marquee select; a plain click (no movement)
        // clears the selection on pointer-up.
        drawRef.current = { kind: "marquee", from: pt, to: pt };
        setPreview(null); // becomes visible once it actually moves
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
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
      case "draw-zone":
      case "draw-ellipse": {
        drawRef.current = { kind: "zone", shape: tool === "draw-ellipse" ? "ellipse" : undefined, from: pt, to: pt };
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
        case "group":
          state.moveEntities(
            drag.offsets.map((o) => ({ id: o.id, pt: { x: pt.x + o.offX, y: pt.y + o.offY } }))
          );
          break;
        case "zone-move":
          state.updateAnnotation(drag.id, {
            ...(drag.points0 ? { points: drag.points0.map((point) => ({ x: point.x + pt.x - drag.grab.x, y: point.y + pt.y - drag.grab.y })) } : {}),
            rect: {
              ...drag.rect0,
              x: drag.rect0.x + (pt.x - drag.grab.x),
              y: drag.rect0.y + (pt.y - drag.grab.y),
            },
          });
          break;
        case "zone-resize":
          state.updateAnnotation(drag.id, {
            ...(drag.points0 ? { points: resizePolygon(drag.points0, { x: drag.rect0.x, y: drag.rect0.y, w: Math.max(1, pt.x - drag.rect0.x), h: Math.max(1, pt.y - drag.rect0.y) }) } : {}),
            rect: {
              x: drag.rect0.x,
              y: drag.rect0.y,
              w: Math.max(1, pt.x - drag.rect0.x),
              h: Math.max(1, pt.y - drag.rect0.y),
            },
          });
          break;
        case "zone-vertex":
        case "arrow-via": {
          const entity = state.drill.entities.find((item) => item.id === drag.id);
          if (!entity || !isAnnotation(entity)) break;
          const key = drag.kind === "zone-vertex" ? "points" : "via";
          const points = entity[key]?.map((point, index) => index === drag.index ? { ...pt } : { ...point });
          if (points) state.updateAnnotation(drag.id, { [key]: points });
          break;
        }
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
      if (drawRef.current.kind === "marquee") {
        const len = Math.hypot(pt.x - drawRef.current.from.x, pt.y - drawRef.current.from.y);
        setPreview(len > 0.6 ? drawRef.current : null);
      } else {
        setPreview(drawRef.current);
      }
    }
  };

  const onBoardPointerUp = (pt: Point, e?: React.PointerEvent<SVGSVGElement>) => {
    const state = useEditor.getState();
    if (dragRef.current) {
      dragRef.current = null;
      state.endGesture();
      return;
    }
    const draw = drawRef.current;
    if (draw) {
      if (draw.kind === "polygon" || draw.kind === "polyline") return;
      drawRef.current = null;
      setPreview(null);
      const len = Math.hypot(pt.x - draw.from.x, pt.y - draw.from.y);
      if (draw.kind === "marquee") {
        if (len <= 0.6) {
          state.clearSelection();
          return;
        }
        const x1 = Math.min(draw.from.x, pt.x);
        const x2 = Math.max(draw.from.x, pt.x);
        const y1 = Math.min(draw.from.y, pt.y);
        const y2 = Math.max(draw.from.y, pt.y);
        const poses = posesAtStep(state.drill, state.currentStep);
        const hits = state.drill.entities
          .filter((en) => en.kind !== "arrow" && en.kind !== "zone")
          .filter((en) => {
            const pose = poses.get(en.id);
            return pose && !pose.hidden && pose.x >= x1 && pose.x <= x2 && pose.y >= y1 && pose.y <= y2;
          })
          .map((en) => en.id);
        state.select(hits, e?.shiftKey);
        return;
      }
      if (draw.kind === "zone") {
        if (len > 1.5) {
          state.addZone({
            x: Math.min(draw.from.x, pt.x),
            y: Math.min(draw.from.y, pt.y),
            w: Math.max(1, Math.abs(pt.x - draw.from.x)),
            h: Math.max(1, Math.abs(pt.y - draw.from.y)),
          }, draw.shape);
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
