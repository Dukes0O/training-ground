import { renderToStaticMarkup } from "react-dom/server";
import { BoardSvg } from "../board/BoardSvg";
import { DEFAULT_BOARD_DISPLAY, sceneWithDisplay, type BoardDisplayOptions } from "../model/boardDisplay";
import { getTimeline } from "../model/resolve";
import type { Drill } from "../model/types";
import { resolvePitch } from "../pitch/formats";
import { boardExportDimensions } from "../model/boardCamera";
import { fixedPitchFraming } from "../model/cameraTracking";

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
  displayOptions?: BoardDisplayOptions;
  /** Draw into this canvas (so encoders can wrap it); otherwise one is created. */
  canvas?: HTMLCanvasElement;
}

export function exportDimensions(drill: Drill, widthPx: number, displayOptions: BoardDisplayOptions = DEFAULT_BOARD_DISPLAY): { width: number; height: number } {
  return boardExportDimensions(resolvePitch(drill.pitch), widthPx, displayOptions.view, displayOptions.appearance, displayOptions.surroundings, displayOptions.playerSize, fixedPitchFraming(displayOptions.cameraMode));
}

/**
 * Deterministic offline frame loop: rasterizes the same BoardSvg the editor
 * shows, at a fixed timestep, into one reused canvas. Every export format
 * (video, GIF) consumes this generator — there is no second draw path.
 */
export async function* renderFrames(
  drill: Drill,
  gridOn: boolean,
  { widthPx = 1280, fps = 30, signal, canvas, displayOptions = DEFAULT_BOARD_DISPLAY }: RenderOptions = {}
): AsyncGenerator<RenderedFrame> {
  const display = { ...displayOptions };
  const tl = getTimeline(drill);
  const { width, height } = exportDimensions(drill, widthPx, displayOptions);
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
    const snapshot = sceneWithDisplay(drill, timeMs, gridOn, display);
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
