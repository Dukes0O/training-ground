import { renderToStaticMarkup } from "react-dom/server";
import { BoardSvg } from "../board/BoardSvg";
import { getTimeline, sceneAt } from "../model/resolve";
import type { Drill } from "../model/types";
import { APRON, resolvePitch } from "../pitch/formats";

export interface RenderedFrame {
  canvas: HTMLCanvasElement;
  index: number;
  total: number;
  timeMs: number;
}

export interface RenderOptions {
  widthPx?: number;
  fps?: number;
  signal?: AbortSignal;
  /** Draw into this canvas (so encoders can wrap it); otherwise one is created. */
  canvas?: HTMLCanvasElement;
}

export function exportDimensions(drill: Drill, widthPx: number): { width: number; height: number } {
  const spec = resolvePitch(drill.pitch);
  const vbW = spec.length + 2 * APRON;
  const vbH = spec.width + 2 * APRON;
  // H.264 requires even dimensions.
  const width = Math.round(widthPx / 2) * 2;
  const height = Math.round((widthPx * vbH) / vbW / 2) * 2;
  return { width, height };
}

/**
 * Deterministic offline frame loop: rasterizes the same BoardSvg the editor
 * shows, at a fixed timestep, into one reused canvas. Every export format
 * (video, GIF) consumes this generator — there is no second draw path.
 */
export async function* renderFrames(
  drill: Drill,
  gridOn: boolean,
  { widthPx = 1280, fps = 30, signal, canvas }: RenderOptions = {}
): AsyncGenerator<RenderedFrame> {
  const tl = getTimeline(drill);
  const { width, height } = exportDimensions(drill, widthPx);
  const target = canvas ?? document.createElement("canvas");
  target.width = width;
  target.height = height;
  const ctx = target.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");

  const frameMs = 1000 / fps;
  const total = Math.max(2, Math.ceil(tl.totalMs / frameMs) + 1);
  const img = new Image();

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
    const timeMs = Math.min(i * frameMs, tl.totalMs);
    const snapshot = sceneAt(drill, timeMs, gridOn);
    const markup = renderToStaticMarkup(<BoardSvg snapshot={snapshot} width={width} height={height} />);
    const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      img.src = url;
      await img.decode();
      ctx.drawImage(img, 0, 0, width, height);
    } finally {
      URL.revokeObjectURL(url);
    }
    yield { canvas: target, index: i, total, timeMs };
  }
}
