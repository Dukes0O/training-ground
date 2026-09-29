import { renderToStaticMarkup } from "react-dom/server";
import { BoardSvg } from "../board/BoardSvg";
import { DEFAULT_BOARD_DISPLAY, sceneWithDisplay, stepWithDisplay, type BoardDisplayOptions } from "../model/boardDisplay";
import type { Drill } from "../model/types";
import { boardExportDimensions } from "../model/boardCamera";
import { fixedPitchFraming } from "../model/cameraTracking";
import { exportBaseName } from "./exportName";
import { saveExportBlob, type ExportDestination, type SavedExport } from "./saveExport";

/**
 * Rasterize one moment of the drill to PNG via the same BoardSvg the editor
 * renders, and download it through the browser by default.
 */
export async function exportPng(
  drill: Drill,
  stepIndex: number,
  gridOn: boolean,
  widthPx = 1920,
  signal?: AbortSignal,
  displayOptions: BoardDisplayOptions = DEFAULT_BOARD_DISPLAY,
  timeMs?: number,
  destination: ExportDestination = "download"
): Promise<SavedExport> {
  const snapshot = timeMs === undefined
    ? stepWithDisplay(drill, stepIndex, gridOn, displayOptions)
    : sceneWithDisplay(drill, timeMs, gridOn, displayOptions);
  const { width: renderedWidth, height: heightPx } = boardExportDimensions(snapshot.spec, widthPx, displayOptions.view, displayOptions.appearance, displayOptions.surroundings, displayOptions.playerSize, fixedPitchFraming(displayOptions.cameraMode));

  const markup = renderToStaticMarkup(
    <BoardSvg snapshot={snapshot} width={renderedWidth} height={heightPx} />
  );
  const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = renderedWidth;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    ctx.drawImage(img, 0, 0, renderedWidth, heightPx);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png")
    );
    signal?.throwIfAborted();
    return await saveExportBlob(drill.id, `${exportBaseName(drill)}.png`, png, destination, signal);
  } finally {
    URL.revokeObjectURL(url);
  }
}
