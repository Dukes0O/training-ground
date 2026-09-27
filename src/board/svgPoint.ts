import type { Point } from "../model/types";

/** Convert a client (mouse) coordinate to board coordinates (meters). */
export function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  // The ground group includes the chosen camera; the root CTM alone only
  // accounts for viewport zoom/pan and would make rotated-board drags jump.
  const ground = svg.querySelector<SVGGElement>("[data-board-world]");
  const ctm = (ground ?? svg).getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}
