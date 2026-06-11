import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Annotation, ArrowStyle, Equipment, Player, TeamId } from "../model/types";
import { pitchFormatId, resolvePitch } from "../pitch/formats";
import { EQUIPMENT_DEFAULT_COLORS, EQUIPMENT_LABELS } from "../board/entities/EquipmentGlyph";
import { posesAtStep } from "../model/resolve";
import { useEditor } from "../state/store";

const POSITIONS = [
  "GK", "RB", "RCB", "CB", "LCB", "LB", "RWB", "LWB",
  "CDM", "RCM", "CM", "LCM", "CAM", "RM", "LM", "RW", "LW", "CF", "SS", "ST",
];

const SWATCHES = ["#ffffff", "#facc15", "#f97316", "#dc2626", "#2563eb", "#16a34a", "#18181b"];
const EQUIPMENT_SWATCHES = ["#f97316", "#facc15", "#dc2626", "#2563eb", "#ffffff", "#16a34a", "#e4e4e7"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-700/40";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-zinc-800">{children}</h2>;
}

function Swatches({
  colors,
  value,
  onPick,
}: {
  colors: string[];
  value: string;
  onPick: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          title={c}
          onClick={() => onPick(c)}
          className={`h-7 w-7 rounded-full border ${
            value.toLowerCase() === c.toLowerCase() ? "ring-2 ring-blue-700 ring-offset-1" : "border-zinc-300"
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function DeleteButton() {
  const removeSelected = useEditor((s) => s.removeSelected);
  return (
    <button
      onClick={removeSelected}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
    >
      <Trash2 size={15} />
      Remove from drill
    </button>
  );
}

/** Shown when the entity has its own keyframe on the current (non-setup) step. */
function EntityStepActions({ id }: { id: string }) {
  const currentStep = useEditor((s) => s.currentStep);
  const hasExplicit = useEditor((s) => s.drill.steps[s.currentStep]?.positions[id] != null);
  const resetPose = useEditor((s) => s.resetPoseAtCurrentStep);
  if (currentStep === 0 || !hasExplicit) return null;
  return (
    <button
      onClick={() => resetPose(id)}
      className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
    >
      Clear this step's move (stay at previous spot)
    </button>
  );
}

function RosterFill({ player }: { player: Player }) {
  const rosters = useEditor((s) => s.rosters);
  const updatePlayer = useEditor((s) => s.updatePlayer);
  const options = rosters.teams.flatMap((team) =>
    team.players
      .filter((p) => p.name)
      .map((p) => ({
        key: `${team.id}/${p.id}`,
        label: `${p.name}${p.number != null ? ` · #${p.number}` : ""}${p.position ? ` · ${p.position}` : ""}`,
        team,
        p,
      }))
  );
  if (options.length === 0) return null;
  return (
    <Field label="Fill from roster">
      <select
        value=""
        onChange={(e) => {
          const opt = options.find((o) => o.key === e.target.value);
          if (opt) {
            updatePlayer(player.id, {
              name: opt.p.name,
              number: opt.p.number,
              position: opt.p.position,
              rosterRef: opt.key,
            });
          }
        }}
        className={inputCls}
      >
        <option value="">Pick a player…</option>
        {rosters.teams.map((team) => (
          <optgroup key={team.id} label={team.name}>
            {options
              .filter((o) => o.team.id === team.id)
              .map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </Field>
  );
}

function PlayerForm({ player }: { player: Player }) {
  const updatePlayer = useEditor((s) => s.updatePlayer);
  return (
    <div className="space-y-3">
      <SectionTitle>Player</SectionTitle>
      <RosterFill player={player} />
      <Field label="Team">
        <select
          value={player.team}
          onChange={(e) => updatePlayer(player.id, { team: e.target.value as TeamId })}
          className={inputCls}
        >
          <option value="home">Home</option>
          <option value="away">Away</option>
          <option value="neutral">Neutral</option>
        </select>
      </Field>
      <Field label="Number">
        <input
          type="number"
          min={1}
          max={99}
          value={player.number ?? ""}
          onChange={(e) =>
            updatePlayer(player.id, {
              number: e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
          className={inputCls}
        />
      </Field>
      <Field label="Name">
        <input
          value={player.name ?? ""}
          spellCheck={false}
          placeholder="e.g. Aiden"
          onChange={(e) => updatePlayer(player.id, { name: e.target.value || undefined })}
          className={inputCls}
        />
      </Field>
      <Field label="Position">
        <input
          value={player.position ?? ""}
          list="position-options"
          spellCheck={false}
          placeholder="e.g. CM"
          onChange={(e) => updatePlayer(player.id, { position: e.target.value || undefined })}
          className={inputCls}
        />
        <datalist id="position-options">
          {POSITIONS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <EntityStepActions id={player.id} />
      <DeleteButton />
    </div>
  );
}

function RotationField({ id }: { id: string }) {
  const currentStep = useEditor((s) => s.currentStep);
  const rotation = useEditor(
    (s) => posesAtStep(s.drill, currentStep).get(id)?.rotation ?? 0
  );
  const setEntityRotation = useEditor((s) => s.setEntityRotation);
  return (
    <Field label="Rotation (°)">
      <input
        type="number"
        step={15}
        value={Math.round(rotation)}
        onChange={(e) => setEntityRotation(id, Number(e.target.value) || 0)}
        className={inputCls}
      />
    </Field>
  );
}

function EquipmentForm({ equipment }: { equipment: Equipment }) {
  const setEquipmentColor = useEditor((s) => s.setEquipmentColor);
  const current = equipment.color ?? EQUIPMENT_DEFAULT_COLORS[equipment.kind] ?? "#e4e4e7";
  return (
    <div className="space-y-3">
      <SectionTitle>{EQUIPMENT_LABELS[equipment.kind] ?? "Equipment"}</SectionTitle>
      <Field label="Color">
        <Swatches colors={EQUIPMENT_SWATCHES} value={current} onPick={(c) => setEquipmentColor(equipment.id, c)} />
      </Field>
      {(equipment.kind === "minigoal" || equipment.kind === "ladder" || equipment.kind === "hurdle") && (
        <RotationField id={equipment.id} />
      )}
      <EntityStepActions id={equipment.id} />
      <DeleteButton />
    </div>
  );
}

type VisMode = "all" | "single" | "range";

function visModeOf(a: Annotation): VisMode {
  if (a.fromStep == null && a.toStep == null) return "all";
  if (a.fromStep != null && a.fromStep === a.toStep) return "single";
  return "range";
}

function VisibilityField({ annotation }: { annotation: Annotation }) {
  const updateAnnotation = useEditor((s) => s.updateAnnotation);
  const currentStep = useEditor((s) => s.currentStep);
  const stepCount = useEditor((s) => s.drill.steps.length);
  const mode = visModeOf(annotation);
  const numCls = `${inputCls} text-center`;
  return (
    <Field label="Visible">
      <div className="space-y-2">
        <select
          value={mode}
          onChange={(e) => {
            const m = e.target.value as VisMode;
            if (m === "all") updateAnnotation(annotation.id, { fromStep: undefined, toStep: undefined });
            else if (m === "single")
              updateAnnotation(annotation.id, { fromStep: currentStep, toStep: currentStep });
            else
              updateAnnotation(annotation.id, {
                fromStep: annotation.fromStep ?? currentStep,
                toStep: stepCount - 1,
              });
          }}
          className={inputCls}
        >
          <option value="all">Every step</option>
          <option value="single">One step only</option>
          <option value="range">Step range</option>
        </select>
        {mode === "single" && (
          <input
            type="number"
            min={1}
            max={stepCount}
            value={(annotation.fromStep ?? 0) + 1}
            onChange={(e) => {
              const k = Math.min(Math.max(Number(e.target.value) - 1, 0), stepCount - 1);
              updateAnnotation(annotation.id, { fromStep: k, toStep: k });
            }}
            className={numCls}
          />
        )}
        {mode === "range" && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={stepCount}
              value={(annotation.fromStep ?? 0) + 1}
              onChange={(e) => {
                const k = Math.min(Math.max(Number(e.target.value) - 1, 0), stepCount - 1);
                updateAnnotation(annotation.id, { fromStep: k });
              }}
              className={numCls}
            />
            <span className="text-xs text-zinc-500">to</span>
            <input
              type="number"
              min={1}
              max={stepCount}
              value={(annotation.toStep ?? stepCount - 1) + 1}
              onChange={(e) => {
                const k = Math.min(Math.max(Number(e.target.value) - 1, 0), stepCount - 1);
                updateAnnotation(annotation.id, { toStep: k });
              }}
              className={numCls}
            />
          </div>
        )}
      </div>
    </Field>
  );
}

function ArrowForm({ annotation }: { annotation: Annotation }) {
  const updateAnnotation = useEditor((s) => s.updateAnnotation);
  return (
    <div className="space-y-3">
      <SectionTitle>Arrow</SectionTitle>
      <Field label="Style">
        <select
          value={annotation.style ?? "plain"}
          onChange={(e) => updateAnnotation(annotation.id, { style: e.target.value as ArrowStyle })}
          className={inputCls}
        >
          <option value="pass">Pass (solid)</option>
          <option value="run">Run (dashed)</option>
          <option value="dribble">Dribble (wavy)</option>
          <option value="shot">Shot (thick)</option>
          <option value="plain">Plain</option>
        </select>
      </Field>
      <Field label="Color">
        <Swatches
          colors={SWATCHES}
          value={annotation.color ?? "#ffffff"}
          onPick={(c) => updateAnnotation(annotation.id, { color: c })}
        />
      </Field>
      <VisibilityField annotation={annotation} />
      <p className="text-xs leading-relaxed text-zinc-500">
        Drag the round handles to move the ends. Ends dropped on a player or ball anchor to them
        and follow their runs.
      </p>
      <DeleteButton />
    </div>
  );
}

function ZoneForm({ annotation }: { annotation: Annotation }) {
  const updateAnnotation = useEditor((s) => s.updateAnnotation);
  return (
    <div className="space-y-3">
      <SectionTitle>Zone</SectionTitle>
      <Field label="Caption">
        <input
          value={annotation.text ?? ""}
          spellCheck={false}
          placeholder="e.g. Build-up zone"
          onChange={(e) => updateAnnotation(annotation.id, { text: e.target.value || undefined })}
          className={inputCls}
        />
      </Field>
      <Field label="Color">
        <Swatches
          colors={SWATCHES}
          value={annotation.color ?? "#facc15"}
          onPick={(c) => updateAnnotation(annotation.id, { color: c })}
        />
      </Field>
      <VisibilityField annotation={annotation} />
      <p className="text-xs leading-relaxed text-zinc-500">
        Drag the zone to move it; drag the corner handle to resize.
      </p>
      <DeleteButton />
    </div>
  );
}

function LabelForm({ annotation }: { annotation: Annotation }) {
  const updateAnnotation = useEditor((s) => s.updateAnnotation);
  return (
    <div className="space-y-3">
      <SectionTitle>Text label</SectionTitle>
      <Field label="Text">
        <input
          value={annotation.text ?? ""}
          spellCheck={false}
          autoFocus
          onChange={(e) => updateAnnotation(annotation.id, { text: e.target.value })}
          className={inputCls}
        />
      </Field>
      <Field label="Color">
        <Swatches
          colors={SWATCHES}
          value={annotation.color ?? "#ffffff"}
          onPick={(c) => updateAnnotation(annotation.id, { color: c })}
        />
      </Field>
      <VisibilityField annotation={annotation} />
      <EntityStepActions id={annotation.id} />
      <DeleteButton />
    </div>
  );
}

function TagsField() {
  const drillId = useEditor((s) => s.drillId);
  const tags = useEditor((s) => s.drill.tags);
  const setTags = useEditor((s) => s.setTags);
  const [text, setText] = useState((tags ?? []).join(", "));
  useEffect(() => {
    setText((tags ?? []).join(", "));
    // Re-sync the input when another drill is opened or tags change elsewhere.
  }, [drillId, tags]);
  const commit = () =>
    setTags(
      text
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    );
  return (
    <Field label="Tags (comma-separated)">
      <input
        value={text}
        spellCheck={false}
        placeholder="passing, warmup, U11"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={inputCls}
      />
    </Field>
  );
}

function StepForm() {
  const currentStep = useEditor((s) => s.currentStep);
  const step = useEditor((s) => s.drill.steps[s.currentStep]);
  const updateStepMeta = useEditor((s) => s.updateStepMeta);
  if (!step) return null;
  const isSetup = currentStep === 0;
  return (
    <div className="space-y-3 border-t border-zinc-100 pt-3">
      <SectionTitle>{isSetup ? "Setup step" : `Step ${currentStep + 1}`}</SectionTitle>
      <Field label="Step name">
        <input
          value={step.name ?? ""}
          spellCheck={false}
          placeholder={isSetup ? "Setup" : "e.g. Switch play"}
          onChange={(e) => updateStepMeta(currentStep, { name: e.target.value || null })}
          className={inputCls}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={isSetup ? "Hold (s)" : "Move time (s)"}>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={(step.durationMs ?? (isSetup ? 800 : 2000)) / 1000}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) updateStepMeta(currentStep, { durationMs: Math.round(n * 1000) });
            }}
            className={inputCls}
          />
        </Field>
        {!isSetup && (
          <Field label="Pause after (s)">
            <input
              type="number"
              min={0}
              step={0.1}
              value={(step.pauseAfterMs ?? 300) / 1000}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 0) updateStepMeta(currentStep, { pauseAfterMs: Math.round(n * 1000) });
              }}
              className={inputCls}
            />
          </Field>
        )}
      </div>
      {!isSetup && (
        <Field label="Movement ease">
          <select
            value={step.ease ?? ""}
            onChange={(e) =>
              updateStepMeta(currentStep, { ease: (e.target.value || null) as never })
            }
            className={inputCls}
          >
            <option value="">Default (ease in-out)</option>
            <option value="linear">Linear</option>
            <option value="easeIn">Ease in</option>
            <option value="easeOut">Ease out</option>
            <option value="easeInOut">Ease in-out</option>
          </select>
        </Field>
      )}
      <p className="text-xs leading-relaxed text-zinc-500">
        {isSetup
          ? "The setup step is the starting picture; its time is how long the first frame holds."
          : "Move time animates pieces into this step's spots. Drag pieces on the board to set where they arrive."}
      </p>
    </div>
  );
}

function DrillMeta() {
  const drill = useEditor((s) => s.drill);
  const setDescription = useEditor((s) => s.setDescription);
  const spec = resolvePitch(drill.pitch);
  const players = drill.entities.filter((e) => e.kind === "player").length;
  return (
    <div className="space-y-3">
      <SectionTitle>Drill</SectionTitle>
      <Field label="Description">
        <textarea
          value={drill.description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          spellCheck={false}
          placeholder="One-liner for the library and the team site"
          className={`${inputCls} resize-none`}
        />
      </Field>
      <TagsField />
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
        <div className="flex justify-between py-0.5">
          <span>Pitch</span>
          <span className="font-medium text-zinc-800">{pitchFormatId(drill.pitch)}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span>Size</span>
          <span className="font-medium text-zinc-800">
            {spec.length} × {spec.width} m
          </span>
        </div>
        <div className="flex justify-between py-0.5">
          <span>Players</span>
          <span className="font-medium text-zinc-800">{players}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span>Steps</span>
          <span className="font-medium text-zinc-800">{drill.steps.length}</span>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-zinc-500">
        Click a tool on the left rail, then click the board to place pieces — arrows and zones are
        drawn by dragging. Select a piece to edit it here. Delete removes, arrow keys nudge.
      </p>
    </div>
  );
}

export function InspectorPanel() {
  const selection = useEditor((s) => s.selection);
  const entities = useEditor((s) => s.drill.entities);

  let body: React.ReactNode;
  if (selection.length === 1) {
    const entity = entities.find((e) => e.id === selection[0]);
    if (!entity) body = <DrillMeta />;
    else if (entity.kind === "player") body = <PlayerForm player={entity} />;
    else if (entity.kind === "arrow") body = <ArrowForm annotation={entity} />;
    else if (entity.kind === "zone") body = <ZoneForm annotation={entity} />;
    else if (entity.kind === "label") body = <LabelForm annotation={entity} />;
    else if (entity.kind === "ball")
      body = (
        <div className="space-y-3">
          <SectionTitle>Ball</SectionTitle>
          <EntityStepActions id={entity.id} />
          <DeleteButton />
        </div>
      );
    // All annotation/player/ball kinds are handled above; what's left is equipment.
    else body = <EquipmentForm equipment={entity as Equipment} />;
  } else if (selection.length > 1) {
    body = (
      <div className="space-y-3">
        <SectionTitle>{selection.length} pieces selected</SectionTitle>
        <p className="text-xs text-zinc-500">Arrow keys nudge everything selected.</p>
        <DeleteButton />
      </div>
    );
  } else {
    body = (
      <div className="space-y-4">
        <DrillMeta />
        <StepForm />
      </div>
    );
  }

  return <div className="p-4">{body}</div>;
}
