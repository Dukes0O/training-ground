import { api } from "../api/client";
import { getTimeline } from "../model/resolve";
import { useBoardDisplay } from "../state/boardDisplay";
import { useEditor } from "../state/store";

// Load renderers and encoders only when an export starts. Imports stay inside
// guarded so loading errors and cancellation use the normal export feedback.

// One export runs at a time; the modal's Cancel aborts it.
let controller: AbortController | null = null;

export function cancelExport() {
  controller?.abort();
}

function setJob(job: { kind: string; phase: string; done: number; total: number } | null) {
  useEditor.setState({ exportJob: job });
}

function progressFor(kind: string) {
  return (done: number, total: number, phase: string) => setJob({ kind, phase, done, total });
}

async function guarded<T>(kind: string, fn: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
  const state = useEditor.getState();
  if (state.exportJob) return null; // one at a time
  if (state.recordingActive) {
    state.addToast("info", "Finish the narration take first — an export's progress dialog would end up in the video.");
    return null;
  }
  controller = new AbortController();
  setJob({ kind, phase: "Starting", done: 0, total: 1 });
  try {
    return await fn(controller.signal);
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      useEditor.getState().addToast("info", "Export cancelled.");
    } else {
      useEditor.getState().addToast("error", `Export failed: ${(err as Error).message}`);
    }
    return null;
  } finally {
    controller = null;
    setJob(null);
  }
}

function revealToast(text: string, path: string) {
  useEditor.getState().addToast("success", text, {
    label: "Reveal",
    run: () => void api.reveal(path),
  });
}

export async function runPngExport(): Promise<void> {
  const { drill, currentStep, gridOn, mode, timeMs } = useEditor.getState();
  const displayOptions = { ...useBoardDisplay.getState().options };
  await guarded("Snapshot PNG", async (signal) => {
    const { exportPng } = await import("./exportPng");
    signal.throwIfAborted();
    const r = await exportPng(drill, currentStep, gridOn, 1920, signal, displayOptions, mode === "playback" ? timeMs : undefined);
    useEditor.getState().addToast("success", `Snapshot downloaded: ${r.name}`);
    return r;
  });
}

export async function runVideoExport(): Promise<void> {
  const { drill, gridOn, appSettings } = useEditor.getState();
  const displayOptions = { ...useBoardDisplay.getState().options };
  await guarded("Video", async (signal) => {
    const { exportVideo } = await import("./exportVideo");
    signal.throwIfAborted();
    const r = await exportVideo(drill, gridOn, {
      widthPx: appSettings.video?.width ?? 1280,
      fps: appSettings.video?.fps ?? 30,
      signal,
      displayOptions,
      onProgress: progressFor("Video"),
    });
    useEditor.getState().addToast("success", `Video downloaded (${r.container.toUpperCase()}): ${r.name}`);
    return r;
  });
}

export async function runGifExport(): Promise<void> {
  const { drill, gridOn, appSettings } = useEditor.getState();
  const displayOptions = { ...useBoardDisplay.getState().options };
  await guarded("GIF", async (signal) => {
    const { estimateGifIsHeavy, exportGif } = await import("./exportGif");
    signal.throwIfAborted();
    if (estimateGifIsHeavy(getTimeline(drill).totalMs)) {
      useEditor
        .getState()
        .addToast("info", "Heads up: this drill runs past 20s — the GIF will be large. MP4 is usually the better post.");
    }
    const r = await exportGif(drill, gridOn, {
      widthPx: appSettings.gif?.width ?? 720,
      fps: appSettings.gif?.fps ?? 12,
      signal,
      displayOptions,
      onProgress: progressFor("GIF"),
    });
    useEditor.getState().addToast("success", `GIF downloaded: ${r.name}`);
    return r;
  });
}

/**
 * Site bundle: poster PNG + GIF + video + drill JSON + manifest snippet, laid
 * out by the server under exports/<id>/site-bundle for handoff to the
 * soccer-quizzes site agent.
 */
export async function runBundleExport(): Promise<void> {
  const { drill, gridOn } = useEditor.getState();
  const displayOptions = { ...useBoardDisplay.getState().options };
  await guarded("Site bundle", async (signal) => {
    const assets: string[] = [];
    setJob({ kind: "Site bundle", phase: "Poster PNG", done: 0, total: 1 });
    const { exportPng } = await import("./exportPng");
    signal.throwIfAborted();
    const png = await exportPng(drill, 0, gridOn, 1920, signal, displayOptions, undefined, "repository");
    if (!png.path) throw new Error("Poster PNG was not saved to the project.");
    assets.push(png.path.split(/[\\/]/).pop()!);

    const { exportGif } = await import("./exportGif");
    signal.throwIfAborted();
    const gif = await exportGif(drill, gridOn, {
      signal,
      displayOptions,
      destination: "repository",
      onProgress: (d, t, p) => setJob({ kind: "Site bundle", phase: `GIF — ${p}`, done: d, total: t }),
    });
    if (!gif.path) throw new Error("GIF was not saved to the project.");
    assets.push(gif.path.split(/[\\/]/).pop()!);

    const { exportVideo } = await import("./exportVideo");
    signal.throwIfAborted();
    const video = await exportVideo(drill, gridOn, {
      signal,
      displayOptions,
      destination: "repository",
      onProgress: (d, t, p) => setJob({ kind: "Site bundle", phase: `Video — ${p}`, done: d, total: t }),
    });
    if (!video.path) throw new Error("Video was not saved to the project.");
    assets.push(video.path.split(/[\\/]/).pop()!);

    setJob({ kind: "Site bundle", phase: "Assembling bundle", done: 1, total: 1 });
    const bundle = await api.postBundle(drill.id, {
      title: drill.title,
      description: drill.description ?? "",
      themeColor: drill.themeColor ?? "#1e40af",
      assets,
    });
    revealToast(`Site bundle ready: ${bundle.path}`, bundle.path);
    return bundle;
  });
}
