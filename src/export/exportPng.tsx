import { renderToStaticMarkup } from "react-dom/server";
import { api } from "../api/client";
import { BoardSvg } from "../board/BoardSvg";
import { snapshotAtStep } from "../model/resolve";
import type { Drill } from "../model/types";
import { APRON } from "../pitch/formats";

/**
 * Rasterize one moment of the drill to PNG via the same BoardSvg the editor
 * renders, and save it under exports/<drill-id>/.
 */
export async function exportPng(
  drill: Drill,
  stepIndex: number,
  gridOn: boolean,
  widthPx = 1920
): Promise<{ path: string }> {
  const snapshot = snapshotAtStep(drill, stepIndex, gridOn);
  const vbW = snapshot.spec.length + 2 * APRON;
  const vbH = snapshot.spec.width + 2 * APRON;
  const heightPx = Math.round((widthPx * vbH) / vbW / 2) * 2;

  const markup = renderToStaticMarkup(
    <BoardSvg snapshot={snapshot} width={widthPx} height={heightPx} />
  );
  const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    ctx.drawImage(img, 0, 0, widthPx, heightPx);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png")
    );
    return await api.postAsset(drill.id, `${drill.id}.png`, png);
  } finally {
    URL.revokeObjectURL(url);
  }
}
