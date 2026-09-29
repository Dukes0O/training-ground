import { downloadBlob } from "./saveExport";

export interface NarrationSession {
  /** Start the recorder (call when the countdown finishes). */
  begin: () => void;
  /** Stop and save the take. */
  stop: () => void;
  /** Tear everything down without saving (cancel before/instead of a take). */
  discard: () => void;
}

const MIME_CANDIDATES = [
  { mime: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', ext: "mp4" },
  { mime: "video/mp4", ext: "mp4" },
  { mime: 'video/webm;codecs="vp9,opus"', ext: "webm" },
  { mime: "video/webm", ext: "webm" },
] as const;

function pickMime(): { mime: string; ext: string } {
  for (const c of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  throw new Error("MediaRecorder has no supported video format in this browser.");
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Acquire the tab capture (cropped to the board via Region Capture) and build
 * the recorder, WITHOUT starting it — recording begins on session.begin() so
 * the 3-2-1 countdown never appears in the take. The user picks the tab in
 * the share dialog; the coach's mic is mixed in.
 */
export async function prepareNarration(opts: {
  fileBaseName: string;
  boardEl: HTMLElement;
  micStream: MediaStream;
  onSaving: () => void;
  onStopped: (saved: { name: string } | null, error?: Error) => void;
}): Promise<NarrationSession> {
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: "browser", frameRate: 30 },
    audio: false,
    // Chromium extensions to streamline picking this very tab.
    ...({ preferCurrentTab: true, selfBrowserSurface: "include" } as object),
  });
  const videoTrack = display.getVideoTracks()[0];

  if (typeof CropTarget !== "undefined" && CropTarget && "cropTo" in videoTrack) {
    try {
      const target = await CropTarget.fromElement(opts.boardEl);
      await (videoTrack as BrowserCaptureMediaStreamTrack).cropTo(target);
    } catch {
      // Cropping is cosmetic; keep recording the full tab on failure.
    }
  }

  const mixed = new MediaStream([videoTrack, ...opts.micStream.getAudioTracks()]);
  const { mime, ext } = pickMime();
  const recorder = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  let begun = false;
  let finished = false;

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const finalize = async () => {
    if (finished) return;
    finished = true;
    videoTrack.stop();
    opts.onSaving();
    const name = `${opts.fileBaseName}-narration-${stamp()}.${ext}`;
    try {
      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      if (blob.size === 0) throw new Error("Recording was empty.");
      opts.onStopped(downloadBlob(blob, name));
    } catch (err) {
      opts.onStopped(null, err as Error);
    }
  };

  recorder.onstop = () => void finalize();
  // The browser's own "Stop sharing" pill must end (or abort) the take cleanly.
  videoTrack.addEventListener("ended", () => {
    if (begun && recorder.state !== "inactive") {
      recorder.stop();
    } else if (!begun && !finished) {
      finished = true;
      opts.onStopped(null, new Error("Screen sharing ended before recording started."));
    }
  });

  return {
    begin: () => {
      if (begun || finished) return;
      begun = true;
      recorder.start(1000); // 1s timeslices: a crash loses at most a second
    },
    stop: () => {
      if (recorder.state !== "inactive") recorder.stop();
    },
    discard: () => {
      finished = true;
      if (recorder.state !== "inactive") recorder.stop();
      videoTrack.stop();
    },
  };
}
