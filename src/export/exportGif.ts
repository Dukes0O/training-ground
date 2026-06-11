import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { api } from "../api/client";
import type { Drill } from "../model/types";
import { renderFrames } from "./renderFrames";

export interface GifExportResult {
  path: string;
  bytes: number;
}

export interface GifExportOptions {
  widthPx?: number;
  fps?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, phase: string) => void;
}

/**
 * GIF from the shared frame loop. The board is flat-color, so per-frame
 * palettes quantize cleanly. Defaults stay modest (720 px / 12 fps) to keep
 * file sizes sane for chat apps and the team site.
 */
export async function exportGif(
  drill: Drill,
  gridOn: boolean,
  { widthPx = 720, fps = 12, signal, onProgress }: GifExportOptions = {}
): Promise<GifExportResult> {
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);

  for await (const frame of renderFrames(drill, gridOn, { widthPx, fps, signal })) {
    const ctx = frame.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    const { width, height } = frame.canvas;
    const rgba = ctx.getImageData(0, 0, width, height).data;
    const palette = quantize(rgba, 256, { format: "rgb444" });
    const indexed = applyPalette(rgba, palette, "rgb444");
    gif.writeFrame(indexed, width, height, { palette, delay });
    onProgress?.(frame.index + 1, frame.total, "Encoding GIF");
  }

  gif.finish();
  const bytes = new Uint8Array(gif.bytes()); // fresh ArrayBuffer-backed copy for Blob
  onProgress?.(1, 1, "Saving");
  const saved = await api.postAsset(drill.id, `${drill.id}.gif`, new Blob([bytes], { type: "image/gif" }));
  return { path: saved.path, bytes: saved.bytes };
}

/** Rough size guard: long drills make heavy GIFs; suggest MP4 instead. */
export function estimateGifIsHeavy(totalMs: number): boolean {
  return totalMs > 20000;
}
