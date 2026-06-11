import { useEffect, useRef, useState } from "react";
import { Circle, Mic, Square } from "lucide-react";
import { startNarration } from "../export/narrate";
import type { NarrationSession } from "../export/narrate";
import { api } from "../api/client";
import { Modal } from "./Modal";
import { useEditor } from "../state/store";

type Phase = "idle" | "armed" | "countdown" | "recording" | "saving";

export function RecordDialog() {
  const open = useEditor((s) => s.recordOpen);
  const setRecordOpen = useEditor((s) => s.setRecordOpen);
  const setRecordingActive = useEditor((s) => s.setRecordingActive);
  const addToast = useEditor((s) => s.addToast);

  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(0);
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const micRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<NarrationSession | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const cleanupMic = () => {
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
  };

  const reset = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    cleanupMic();
    setRecordingActive(false);
    setPhase("idle");
    setElapsed(0);
  };

  // Mic level meter while armed.
  useEffect(() => {
    if (phase !== "armed" || !micRef.current) return;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(micRef.current);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const interval = window.setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      setLevel(Math.min(1, peak / 90));
    }, 100);
    return () => {
      clearInterval(interval);
    };
  }, [phase]);

  // Countdown then start the recorder.
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count <= 0) {
      setPhase("recording");
      setRecordingActive(true);
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [phase, count, setRecordingActive]);

  // Elapsed timer while recording.
  useEffect(() => {
    if (phase !== "recording") return;
    const started = performance.now();
    const interval = window.setInterval(() => setElapsed((performance.now() - started) / 1000), 250);
    return () => clearInterval(interval);
  }, [phase]);

  const arm = async () => {
    try {
      micRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setPhase("armed");
    } catch {
      addToast(
        "error",
        "Microphone access was blocked. Allow the mic for 127.0.0.1 in the browser's site settings (lock icon in the address bar), then try again."
      );
    }
  };

  const begin = async () => {
    const { drillId, drill } = useEditor.getState();
    const boardEl = document.querySelector<HTMLElement>("[data-board-root]");
    if (!boardEl || !micRef.current) return;
    try {
      sessionRef.current = await startNarration({
        drillId: drillId ?? drill.id,
        boardEl,
        micStream: micRef.current,
        onStopped: (saved, error) => {
          setRecordingActive(false);
          cleanupMic();
          sessionRef.current = null;
          if (saved) {
            addToast("success", `Narration saved: ${saved.path}`, {
              label: "Reveal",
              run: () => void api.reveal(saved.path),
            });
          } else {
            addToast("error", `Recording failed: ${error?.message ?? "unknown error"}`);
          }
          setPhase("idle");
          setElapsed(0);
          setRecordOpen(false);
        },
      });
      setCount(3);
      setPhase("countdown");
    } catch (err) {
      const msg = (err as Error).name === "NotAllowedError"
        ? "Screen sharing was declined. Pick this tab in the share dialog to record the board."
        : (err as Error).message;
      addToast("error", `Could not start recording: ${msg}`);
    }
  };

  // Floating control bar while recording (the modal would cover the board).
  if (phase === "recording" || (phase === "countdown" && count <= 0)) {
    return (
      <div className="fixed bottom-36 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-red-200 bg-white px-4 py-2 shadow-xl">
        <Circle size={12} className="animate-pulse fill-red-600 text-red-600" />
        <span className="font-mono text-sm tabular-nums text-zinc-800">
          {Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, "0")}
        </span>
        <span className="text-xs text-zinc-500">Play, scrub and talk — it's all being captured.</span>
        <button
          onClick={() => sessionRef.current?.stop()}
          className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
        >
          <Square size={11} />
          Stop & save
        </button>
      </div>
    );
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        setRecordOpen(false);
      }}
      title="Record a narrated take"
      width={460}
    >
      {phase === "idle" && (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-zinc-600">
            Record the board plus your voice while you play, scrub, and explain the drill — a
            ready-to-post coaching clip. Step 1: enable your microphone.
          </p>
          <button
            onClick={() => void arm()}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-800 px-3 py-2 text-sm font-medium text-white hover:bg-blue-900"
          >
            <Mic size={15} />
            Enable microphone
          </button>
        </div>
      )}
      {(phase === "armed" || phase === "countdown") && (
        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Mic check — say something
            </span>
            <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full transition-[width] duration-100 ${level > 0.65 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.round(level * 100)}%` }}
              />
            </div>
          </div>
          {phase === "armed" ? (
            <>
              <p className="text-sm leading-relaxed text-zinc-600">
                Next, the browser asks which tab to share — pick{" "}
                <span className="font-medium text-zinc-900">this tab</span>. Recording starts after
                a 3-2-1 countdown; press Space to play the drill while you talk.
              </p>
              <button
                onClick={() => void begin()}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <Circle size={13} className="fill-white" />
                Share tab & start countdown
              </button>
            </>
          ) : (
            <div className="py-4 text-center text-5xl font-bold text-zinc-800">{count}</div>
          )}
        </div>
      )}
      {phase === "saving" && <p className="text-sm text-zinc-600">Saving…</p>}
    </Modal>
  );
}
