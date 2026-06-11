import { useRef } from "react";
import type { Point } from "../model/types";
import { posesAtStep } from "../model/resolve";
import { useEditor } from "../state/store";

interface DragState {
  id: string;
  offX: number;
  offY: number;
  moved: boolean;
}

/**
 * Pointer state machine for the editing board: drag entities with the select
 * tool, place new entities with the add tools. Pointer capture goes to the
 * <svg> root so moves keep flowing during fast drags.
 */
export function useBoardInteraction() {
  const dragRef = useRef<DragState | null>(null);

  const onEntityPointerDown = (id: string, e: React.PointerEvent<SVGGElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const state = useEditor.getState();
    state.select([id], e.shiftKey);
    const pose = posesAtStep(state.drill, state.currentStep).get(id);
    if (!pose) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    dragRef.current = { id, offX: pose.x - p.x, offY: pose.y - p.y, moved: false };
    state.beginGesture();
    svg.setPointerCapture(e.pointerId);
  };

  const onBoardPointerDown = (pt: Point, e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const state = useEditor.getState();
    switch (state.tool) {
      case "select":
        state.clearSelection();
        break;
      case "add-home":
        state.addPlayer("home", pt);
        break;
      case "add-away":
        state.addPlayer("away", pt);
        break;
      case "add-neutral":
        state.addPlayer("neutral", pt);
        break;
      case "add-ball":
        state.addBall(pt);
        break;
      case "add-cone":
        state.addCone(pt);
        break;
    }
  };

  const onBoardPointerMove = (pt: Point) => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.moved = true;
    useEditor.getState().moveEntity(drag.id, { x: pt.x + drag.offX, y: pt.y + drag.offY });
  };

  const onBoardPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    useEditor.getState().endGesture();
  };

  return { onEntityPointerDown, onBoardPointerDown, onBoardPointerMove, onBoardPointerUp };
}
