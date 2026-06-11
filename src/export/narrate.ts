import { api } from "../api/client";

export interface NarrationSession {
  stop: () => void;
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
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/**
 * Capture the board region of this tab plus the coach's microphone into a
 * video file under exports/<drill-id>/. The user picks the tab in the share
 * dialog; Region Capture (when available) crops the stream to the board so
 * the recording is clean even though the whole app is shared.
 */
export async function startNarration(opts: {
  drillId: string;
  boardEl: HTMLElement;
  micStream: MediaStream;
  onStopped: (saved: { path: string } | null, error?: Error) => void;
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
  let finished = false;

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const finalize = async () => {
    if (finished) return;
    finished = true;
    videoTrack.stop();
    try {
      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      if (blob.size === 0) throw new Error("Recording was empty.");
      const saved = await api.postAsset(opts.drillId, `narration-${stamp()}.${ext}`, blob);
      opts.onStopped(saved);
    } catch (err) {
      opts.onStopped(null, err as Error);
    }
  };

  recorder.onstop = () => void finalize();
  // The browser's own "Stop sharing" pill must end the take cleanly too.
  videoTrack.addEventListener("ended", () => {
    if (recorder.state !== "inactive") recorder.stop();
  });

  recorder.start(1000); // 1s timeslices: a crash loses at most a second

  return {
    stop: () => {
      if (recorder.state !== "inactive") recorder.stop();
    },
  };
}
