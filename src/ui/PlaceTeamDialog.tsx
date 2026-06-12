import { useEffect, useMemo, useState } from "react";
import { FORMATIONS } from "../model/formations";
import type { TeamId } from "../model/types";
import { pitchFormatId } from "../pitch/formats";
import { Modal } from "./Modal";
import { useEditor } from "../state/store";

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-700/40";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

export function PlaceTeamDialog() {
  const open = useEditor((s) => s.placeTeamOpen);
  const setOpen = useEditor((s) => s.setPlaceTeamOpen);
  const pitch = useEditor((s) => s.drill.pitch);
  const entities = useEditor((s) => s.drill.entities);
  const rosters = useEditor((s) => s.rosters);
  const placeTeam = useEditor((s) => s.placeTeam);
  const addToast = useEditor((s) => s.addToast);

  const formatId = pitchFormatId(pitch);
  const formations = FORMATIONS[formatId] ?? [];

  const [team, setTeam] = useState<TeamId>("home");
  const [formationId, setFormationId] = useState("");
  const [defending, setDefending] = useState<"left" | "right">("left");
  const [rosterTeamId, setRosterTeamId] = useState("");
  const [replace, setReplace] = useState(true);

  useEffect(() => {
    if (open) {
      setTeam("home");
      setDefending("left");
      setFormationId(formations[0]?.id ?? "");
      setRosterTeamId("");
      setReplace(true);
    }
    // Reset the form each time the dialog opens for the current pitch format.
  }, [open, formatId]);

  const existingCount = useMemo(
    () => entities.filter((e) => e.kind === "player" && e.team === team).length,
    [entities, team]
  );

  const place = () => {
    const formation = formations.find((f) => f.id === formationId);
    if (!formation) return;
    placeTeam({
      team,
      formation,
      defending,
      rosterTeamId: rosterTeamId || undefined,
      replace,
    });
    addToast("success", `Placed a ${formation.label} ${team} team${rosterTeamId ? " from the roster" : ""}.`);
    setOpen(false);
  };

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Place a full team" width={420}>
      {formations.length === 0 ? (
        <p className="text-sm leading-relaxed text-zinc-600">
          Formations apply to the full-pitch formats (11v11, 9v9, 8v8). Switch the pitch format in
          the top bar, or place players individually on this {formatId} board.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Row label="Team">
              <select
                value={team}
                onChange={(e) => {
                  const t = e.target.value as TeamId;
                  setTeam(t);
                  setDefending(t === "away" ? "right" : "left");
                }}
                className={inputCls}
              >
                <option value="home">Home</option>
                <option value="away">Away</option>
                <option value="neutral">Neutral</option>
              </select>
            </Row>
            <Row label="Formation">
              <select value={formationId} onChange={(e) => setFormationId(e.target.value)} className={inputCls}>
                {formations.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Row>
          </div>
          <Row label="Defending which goal">
            <select
              value={defending}
              onChange={(e) => setDefending(e.target.value as "left" | "right")}
              className={inputCls}
            >
              <option value="left">Left goal (attacks right)</option>
              <option value="right">Right goal (attacks left)</option>
            </select>
          </Row>
          {rosters.teams.some((t) => t.players.some((p) => p.name)) && (
            <Row label="Fill names from roster">
              <select value={rosterTeamId} onChange={(e) => setRosterTeamId(e.target.value)} className={inputCls}>
                <option value="">No — numbers and positions only</option>
                {rosters.teams
                  .filter((t) => t.players.some((p) => p.name))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </Row>
          )}
          {existingCount > 0 && (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
                className="mt-0.5 accent-blue-800"
              />
              Replace the {existingCount} existing {team} player{existingCount === 1 ? "" : "s"} (otherwise the
              new team is added alongside them)
            </label>
          )}
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3">
            <button
              onClick={() => setOpen(false)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              onClick={place}
              className="rounded-md bg-blue-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-900"
            >
              Place team
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
