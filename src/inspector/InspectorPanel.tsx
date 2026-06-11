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

function PlayerForm({ player }: { player: Player }) {
  const updatePlayer = useEditor((s) => s.updatePlayer);
  return (
    <div className="space-y-3">
      <SectionTitle>Player</SectionTitle>
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
      <DeleteButton />
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
    body = <DrillMeta />;
  }

  return <div className="p-4">{body}</div>;
}
