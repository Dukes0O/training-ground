import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  getFirstEncodableVideoCodec,
} from "mediabunny";
import { DEFAULT_BOARD_DISPLAY, type BoardDisplayOptions } from "../model/boardDisplay";
import type { Drill } from "../model/types";
import { exportBaseName } from "./exportName";
import { exportDimensions, renderFrames } from "./renderFrames";
import { saveExportBlob, type ExportDestination, type SavedExport } from "./saveExport";

export interface VideoExportResult extends SavedExport {
  container: "mp4" | "webm";
}

export interface VideoExportOptions {
  widthPx?: number;
  fps?: number;
  signal?: AbortSignal;
  displayOptions?: BoardDisplayOptions;
  destination?: ExportDestination;
  onProgress?: (done: number, total: number, phase: string) => void;
}

/**
 * Offline render → WebCodecs encode → MP4 (H.264) when the OS provides an
 * encoder, else WebM (VP9/AV1). Deterministic timing: every frame is exact.
 */
export async function exportVideo(
  drill: Drill,
  gridOn: boolean,
  { widthPx = 1280, fps = 30, signal, onProgress, displayOptions = DEFAULT_BOARD_DISPLAY, destination = "download" }: VideoExportOptions = {}
): Promise<VideoExportResult> {
  const display = { ...displayOptions };
  const { width, height } = exportDimensions(drill, widthPx, displayOptions);

  const mp4 = new Mp4OutputFormat();
  const webm = new WebMOutputFormat();
  const mp4Codec = await getFirstEncodableVideoCodec(mp4.getSupportedVideoCodecs(), { width, height });
  const webmCodec = mp4Codec
    ? null
    : await getFirstEncodableVideoCodec(webm.getSupportedVideoCodecs(), { width, height });

  if (!mp4Codec && !webmCodec) {
    throw new Error(
      "No video encoder available in this browser. Use Chrome or Edge (WebCodecs required)."
    );
  }
  const container: "mp4" | "webm" = mp4Codec ? "mp4" : "webm";

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const output = new Output({
    format: mp4Codec ? mp4 : webm,
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, {
    codec: (mp4Codec ?? webmCodec)!,
    bitrate: QUALITY_HIGH,
  });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();

  try {
    for await (const frame of renderFrames(drill, gridOn, { widthPx, fps, signal, canvas, displayOptions: display })) {
      await source.add(frame.timeMs / 1000, 1 / fps);
      onProgress?.(frame.index + 1, frame.total, "Rendering frames");
    }
    signal?.throwIfAborted();
    onProgress?.(1, 1, "Finalizing video");
    source.close();
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => undefined);
    throw err;
  }

  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new Error("Encoder produced no output");
  signal?.throwIfAborted();
  onProgress?.(1, 1, "Saving");
  const name = `${exportBaseName(drill)}.${container}`;
  const saved = await saveExportBlob(drill.id, name, new Blob([buffer]), destination, signal);
  return { ...saved, container };
}
