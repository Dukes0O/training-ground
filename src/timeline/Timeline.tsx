import { Fragment, useEffect, useRef, useState } from "react";
import {
  ChevronRight, Copy, Layers3, Pause, Pencil, Play, Plus,
  Repeat, SkipBack, SkipForward, Trash2,
} from "lucide-react";
import { getTimeline, stepAtTime } from "../model/resolve";
import type { Step } from "../model/types";
import { useEditor } from "../state/store";
import "../ui/editor-workspace.css";

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
  const position = Math.min(mode === "playback" ? timeMs : (tl.stepArrivalMs[activeStep] ?? 0), tl.totalMs);

  return (
    <div className="tg-transport">
      <div className="tg-sequence-heading">
        <Layers3 size={16} aria-hidden="true" />
        <strong>Drill sequence</strong>
        <span>{drill.steps.length} {drill.steps.length === 1 ? "step" : "steps"}</span>
      </div>
      <div className="tg-mode-toggle" role="group" aria-label="Editor mode">
        <button onClick={() => setMode("edit")} aria-pressed={mode === "edit"} className={mode === "edit" ? "is-active" : ""}>
          <Pencil size={12} aria-hidden="true" /> Edit
        </button>
        <button onClick={() => setMode("playback")} aria-pressed={mode === "playback"} className={mode === "playback" ? "is-active" : ""}>
          <Play size={12} aria-hidden="true" /> Preview
        </button>
      </div>
      <div className="tg-playback-controls" role="group" aria-label="Playback controls">
        <button title="Previous step" aria-label="Previous step" disabled={activeStep === 0} onClick={() => jumpToStep(activeStep - 1)} className="tg-transport-icon">
          <SkipBack size={15} aria-hidden="true" />
        </button>
        <button title={playing ? "Pause (Space)" : "Play (Space)"} aria-label={playing ? "Pause animation" : "Play animation"} onClick={() => (playing ? pause() : play())} className="tg-play-button">
          {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" fill="currentColor" />}
        </button>
        <button title="Next step" aria-label="Next step" disabled={activeStep >= drill.steps.length - 1} onClick={() => jumpToStep(activeStep + 1)} className="tg-transport-icon">
          <SkipForward size={15} aria-hidden="true" />
        </button>
        <button title={loop ? "Turn loop off" : "Loop animation"} aria-label="Loop animation" aria-pressed={loop} onClick={() => setLoop(!loop)} className={`tg-transport-icon${loop ? " is-active" : ""}`}>
          <Repeat size={15} aria-hidden="true" />
        </button>
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} title="Playback speed" aria-label="Playback speed" className="tg-playback-speed">
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={1.5}>1.5×</option>
        </select>
      </div>
      <div className="tg-scrubber">
        <input type="range" min={0} max={Math.max(tl.totalMs, 1)} step={16} value={position} onChange={(e) => setTimeMs(Number(e.target.value))} aria-label="Animation position" aria-valuetext={`${fmt(position)} of ${fmt(tl.totalMs)}`} />
        <div className="tg-scrubber-markers" aria-hidden="true">
          {tl.stepArrivalMs.map((t, i) => <i key={i} style={{ left: `${(t / Math.max(tl.totalMs, 1)) * 100}%` }} />)}
        </div>
      </div>
      <span className="tg-playback-time"><strong>{fmt(position)}</strong><span> / {fmt(tl.totalMs)}</span></span>
    </div>
  );
}

function DurationInput({ k, step }: { k: number; step: Step }) {
  const updateStepMeta = useEditor((s) => s.updateStepMeta);
  const addStepAfter = useEditor((s) => s.addStepAfter);
  const value = (step.durationMs ?? 2000) / 1000;
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value, k]);
  const commit = () => {
    const n = Number(text);
    if (Number.isFinite(n) && n > 0) updateStepMeta(k, { durationMs: Math.round(n * 1000) });
    else setText(String(value));
  };
  return (
    <div className="tg-step-connector">
      <ChevronRight size={14} aria-hidden="true" />
      <label title={`Transition into step ${k + 1}, in seconds`}>
        <input value={text} inputMode="decimal" aria-label={`Transition into step ${k + 1}, in seconds`} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
        <span>s</span>
      </label>
      <button title="Insert a step here" aria-label={`Insert a step before step ${k + 1}`} onClick={() => addStepAfter(k - 1)}><Plus size={11} aria-hidden="true" /></button>
    </div>
  );
}

function StepStrip({ activeStep }: { activeStep: number }) {
  const steps = useEditor((s) => s.drill.steps);
  const activeRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const { jumpToStep, addStepAfter, duplicateStep, deleteStep, moveStep } = useEditor.getState();

  useEffect(() => {
    const card = activeRef.current;
    const strip = stripRef.current;
    if (!card || !strip) return;
    const cardBounds = card.getBoundingClientRect();
    const stripBounds = strip.getBoundingClientRect();
    if (cardBounds.left < stripBounds.left) strip.scrollLeft -= stripBounds.left - cardBounds.left + 12;
    else if (cardBounds.right > stripBounds.right) strip.scrollLeft += cardBounds.right - stripBounds.right + 12;
  }, [activeStep, steps.length]);

  return (
    <div ref={stripRef} className="tg-step-strip" role="group" aria-label="Drill steps">
      {steps.map((step, k) => (
        <Fragment key={k}>
          {k > 0 && <DurationInput k={k} step={step} />}
          <div
            ref={k === activeStep ? activeRef : undefined}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/step-index", String(k));
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("text/step-index")) e.preventDefault();
            }}
            onDrop={(e) => {
              const source = e.dataTransfer.getData("text/step-index");
              if (source === "") return;
              e.preventDefault();
              const from = Number(source);
              if (Number.isInteger(from) && from >= 0 && from < steps.length && from !== k) moveStep(from, k);
            }}
            className={`tg-step-card${k === activeStep ? " is-active" : ""}`}
          >
            <button
              className="tg-step-select"
              aria-pressed={k === activeStep}
              aria-label={`${k === 0 ? "Setup" : `Step ${k + 1}`}: ${step.name || "Untitled step"}`}
              title="Select step. Drag to reorder, or use Alt + Left / Right."
              onClick={() => jumpToStep(k)}
              onKeyDown={(e) => {
                if (!e.altKey || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
                e.preventDefault();
                e.stopPropagation();
                const next = k + (e.key === "ArrowLeft" ? -1 : 1);
                if (next < 0 || next >= steps.length) return;
                moveStep(k, next);
                stripRef.current?.querySelectorAll<HTMLButtonElement>(".tg-step-select")[next]?.focus();
              }}
            >
              <span className="tg-step-eyebrow"><span className="tg-step-number">{String(k + 1).padStart(2, "0")}</span>{k === 0 ? "Setup" : "Movement"}</span>
              <strong>{step.name || (k === 0 ? "Starting positions" : "New movement")}</strong>
              <span className="tg-step-caption">{k === activeStep ? "Current step" : k === 0 ? "Set the scene" : "Select to edit"}</span>
            </button>
            <div className="tg-step-actions">
              <button title="Duplicate step" aria-label={`Duplicate step ${k + 1}`} onClick={() => duplicateStep(k)}><Copy size={12} aria-hidden="true" /></button>
              {steps.length > 1 && <button title="Delete step" aria-label={`Delete step ${k + 1}`} onClick={() => deleteStep(k)} className="tg-step-delete"><Trash2 size={12} aria-hidden="true" /></button>}
            </div>
          </div>
        </Fragment>
      ))}
      <button onClick={() => addStepAfter(steps.length - 1)} title="Add a step using the current positions" className="tg-add-step"><Plus size={18} aria-hidden="true" /><span>Add step</span></button>
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
    <section
      className="tg-timeline"
      aria-label="Drill timeline"
      onKeyDown={(event) => {
        if (event.key === " " || event.key.startsWith("Arrow")) event.stopPropagation();
      }}
    >
      <Transport />
      <StepStrip activeStep={activeStep} />
    </section>
  );
}
