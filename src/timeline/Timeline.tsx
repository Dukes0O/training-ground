import { Fragment, useEffect, useState } from "react";
import {
  ChevronRight,
  Copy,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  SkipBack,
  SkipForward,
  Trash2,
} from "lucide-react";
import { getTimeline, stepAtTime } from "../model/resolve";
import type { Step } from "../model/types";
import { useEditor } from "../state/store";

function fmt(ms: number): string {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function Transport() {
  const playing = useEditor((s) => s.playing);
  const mode = useEditor((s) => s.mode);
  const timeMs = useEditor((s) => s.timeMs);
  const speed = useEditor((s) => s.speed);
  const loop = useEditor((s) => s.loop);
  const drill = useEditor((s) => s.drill);
  const currentStep = useEditor((s) => s.currentStep);
  const { play, pause, setTimeMs, setSpeed, setLoop, setMode, jumpToStep } = useEditor.getState();
  const tl = getTimeline(drill);
  const activeStep = mode === "playback" ? stepAtTime(tl, timeMs) : currentStep;

  return (
    <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-1.5">
      <div className="flex overflow-hidden rounded-md border border-zinc-300 text-xs font-medium">
        <button
          onClick={() => setMode("edit")}
          className={`flex items-center gap-1 px-2 py-1 ${mode === "edit" ? "bg-blue-800 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
        >
          <Pencil size={12} />
          Edit
        </button>
        <button
          onClick={() => setMode("playback")}
          className={`flex items-center gap-1 px-2 py-1 ${mode === "playback" ? "bg-blue-800 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
        >
          <Play size={12} />
          Preview
        </button>
      </div>
      <div className="h-5 w-px bg-zinc-200" />
      <button
        title="Previous step"
        onClick={() => jumpToStep(activeStep - 1)}
        className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100"
      >
        <SkipBack size={15} />
      </button>
      <button
        title={playing ? "Pause (Space)" : "Play (Space)"}
        onClick={() => (playing ? pause() : play())}
        className="rounded-md bg-blue-800 p-2 text-white hover:bg-blue-900"
      >
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <button
        title="Next step"
        onClick={() => jumpToStep(activeStep + 1)}
        className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100"
      >
        <SkipForward size={15} />
      </button>
      <button
        title="Loop"
        onClick={() => setLoop(!loop)}
        className={`rounded-md p-1.5 ${loop ? "bg-blue-800/10 text-blue-800 ring-1 ring-blue-800/30" : "text-zinc-600 hover:bg-zinc-100"}`}
      >
        <Repeat size={15} />
      </button>
      <select
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value))}
        title="Playback speed"
        className="rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-xs text-zinc-700"
      >
        <option value={0.5}>0.5×</option>
        <option value={1}>1×</option>
        <option value={1.5}>1.5×</option>
      </select>
      <span className="w-24 shrink-0 text-right font-mono text-xs tabular-nums text-zinc-500">
        {fmt(mode === "playback" ? timeMs : (tl.stepArrivalMs[activeStep] ?? 0))} / {fmt(tl.totalMs)}
      </span>
      <div className="relative min-w-0 flex-1 px-1">
        <input
          type="range"
          min={0}
          max={Math.max(tl.totalMs, 1)}
          step={16}
          value={Math.min(mode === "playback" ? timeMs : (tl.stepArrivalMs[activeStep] ?? 0), tl.totalMs)}
          onChange={(e) => setTimeMs(Number(e.target.value))}
          className="w-full accent-blue-800"
        />
        {tl.stepArrivalMs.map((t, i) => (
          <div
            key={i}
            className="pointer-events-none absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded bg-zinc-400/80"
            style={{ left: `calc(${(t / Math.max(tl.totalMs, 1)) * 100}% )` }}
          />
        ))}
      </div>
    </div>
  );
}

function DurationInput({ k, step }: { k: number; step: Step }) {
  const updateStepMeta = useEditor((s) => s.updateStepMeta);
  const value = (step.durationMs ?? 2000) / 1000;
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value, k]);
  const commit = () => {
    const n = Number(text);
    if (Number.isFinite(n) && n > 0) updateStepMeta(k, { durationMs: Math.round(n * 1000) });
    else setText(String(value));
  };
  return (
    <div className="flex w-12 shrink-0 flex-col items-center justify-center gap-0.5 self-center">
      <ChevronRight size={12} className="text-zinc-300" />
      <div className="flex items-center gap-0.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-8 rounded border border-zinc-200 px-0.5 py-0 text-center text-[10px] text-zinc-600 outline-none focus:ring-1 focus:ring-blue-700/40"
        />
        <span className="text-[10px] text-zinc-400">s</span>
      </div>
    </div>
  );
}

function StepStrip({ activeStep }: { activeStep: number }) {
  const steps = useEditor((s) => s.drill.steps);
  const { jumpToStep, addStepAfter, duplicateStep, deleteStep, moveStep } = useEditor.getState();

  return (
    <div className="flex min-h-0 flex-1 items-stretch gap-0 overflow-x-auto px-3 py-1.5">
      {steps.map((step, k) => (
        <Fragment key={k}>
          {k > 0 && <DurationInput k={k} step={step} />}
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/step-index", String(k));
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData("text/step-index"));
              if (Number.isInteger(from) && from !== k) moveStep(from, k);
            }}
            onClick={() => jumpToStep(k)}
            className={`group relative w-28 shrink-0 cursor-pointer rounded-lg border px-2 py-1 transition-colors ${
              k === activeStep
                ? "border-blue-800/50 bg-blue-50 ring-1 ring-blue-800/30"
                : "border-zinc-200 bg-white hover:bg-zinc-50"
            }`}
          >
            <div className="text-[10px] font-semibold tracking-wide text-zinc-400">
              {k === 0 ? "SETUP" : `STEP ${k + 1}`}
            </div>
            <div className="truncate text-xs font-medium text-zinc-800">{step.name || "—"}</div>
            <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
              <button
                title="Duplicate step"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateStep(k);
                }}
                className="rounded bg-white/90 p-0.5 text-zinc-500 shadow-sm hover:text-blue-800"
              >
                <Copy size={12} />
              </button>
              {steps.length > 1 && (
                <button
                  title="Delete step"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteStep(k);
                  }}
                  className="rounded bg-white/90 p-0.5 text-zinc-500 shadow-sm hover:text-red-600"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        </Fragment>
      ))}
      <button
        onClick={() => addStepAfter(steps.length - 1)}
        title="Add step (current poses carry forward)"
        className="ml-2 flex w-20 shrink-0 items-center justify-center gap-1 self-stretch rounded-lg border border-dashed border-zinc-300 text-xs font-medium text-zinc-500 hover:border-blue-800/40 hover:text-blue-800"
      >
        <Plus size={13} />
        Step
      </button>
    </div>
  );
}

export function Timeline() {
  const mode = useEditor((s) => s.mode);
  const timeMs = useEditor((s) => s.timeMs);
  const currentStep = useEditor((s) => s.currentStep);
  const drill = useEditor((s) => s.drill);
  const tl = getTimeline(drill);
  const activeStep = mode === "playback" ? stepAtTime(tl, timeMs) : currentStep;

  return (
    <div className="flex h-[124px] shrink-0 flex-col border-t border-zinc-200 bg-white">
      <Transport />
      <StepStrip activeStep={activeStep} />
    </div>
  );
}
