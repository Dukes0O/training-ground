import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Equipment, Player, TeamId } from "../model/types";
import { pitchFormatId, resolvePitch } from "../pitch/formats";
import { CONE_DEFAULT_COLOR } from "../board/entities/ConeGlyph";
import { useEditor } from "../state/store";

const POSITIONS = [
  "GK", "RB", "RCB", "CB", "LCB", "LB", "RWB", "LWB",
  "CDM", "RCM", "CM", "LCM", "CAM", "RM", "LM", "RW", "LW", "CF", "SS", "ST",
];

const CONE_COLORS = ["#f97316", "#facc15", "#dc2626", "#2563eb", "#ffffff", "#16a34a"];

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

function ConeForm({ equipment }: { equipment: Equipment }) {
  const setEquipmentColor = useEditor((s) => s.setEquipmentColor);
  const current = equipment.color ?? CONE_DEFAULT_COLOR;
  return (
    <div className="space-y-3">
      <SectionTitle>Cone</SectionTitle>
      <Field label="Color">
        <div className="flex gap-1.5">
          {CONE_COLORS.map((c) => (
            <button
              key={c}
              title={c}
              onClick={() => setEquipmentColor(equipment.id, c)}
              className={`h-7 w-7 rounded-full border ${
                current === c ? "ring-2 ring-blue-700 ring-offset-1" : "border-zinc-300"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </Field>
      <EntityStepActions id={equipment.id} />
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
        Click a tool on the left rail, then click the board to place pieces. Select a piece to edit
        it here. Drag to move, arrow keys to nudge, Delete to remove.
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
    if (entity?.kind === "player") body = <PlayerForm player={entity} />;
    else if (entity?.kind === "cone") body = <ConeForm equipment={entity} />;
    else if (entity?.kind === "ball")
      body = (
        <div className="space-y-3">
          <SectionTitle>Ball</SectionTitle>
          <EntityStepActions id={entity.id} />
          <DeleteButton />
        </div>
      );
    else body = <DrillMeta />;
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
