import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { RosterTeam, RostersFile } from "../api/client";
import { saveRosters } from "../api/persistence";
import { Modal } from "../ui/Modal";
import { useEditor } from "../state/store";

function freshId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function RosterDialog() {
  const open = useEditor((s) => s.rosterOpen);
  const setRosterOpen = useEditor((s) => s.setRosterOpen);
  const rosters = useEditor((s) => s.rosters);
  const setRosters = useEditor((s) => s.setRosters);

  const [draft, setDraft] = useState<RostersFile>({ teams: [] });
  const [teamIdx, setTeamIdx] = useState(0);

  useEffect(() => {
    if (open) {
      setDraft(JSON.parse(JSON.stringify(rosters)) as RostersFile);
      setTeamIdx(0);
    }
  }, [open, rosters]);

  const team: RosterTeam | undefined = draft.teams[teamIdx];

  const patchTeam = (patch: Partial<RosterTeam>) => {
    setDraft((d) => ({
      teams: d.teams.map((t, i) => (i === teamIdx ? { ...t, ...patch } : t)),
    }));
  };

  const inputCls =
    "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-700/40";

  return (
    <Modal open={open} onClose={() => setRosterOpen(false)} title="Team roster" width={560}>
      <div className="flex items-center gap-2">
        <select
          value={teamIdx}
          onChange={(e) => setTeamIdx(Number(e.target.value))}
          className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        >
          {draft.teams.map((t, i) => (
            <option key={t.id} value={i}>
              {t.name || "(unnamed team)"}
            </option>
          ))}
          {draft.teams.length === 0 && <option value={0}>No teams yet</option>}
        </select>
        <button
          onClick={() => {
            setDraft((d) => ({
              teams: [...d.teams, { id: freshId("team"), name: "New team", players: [] }],
            }));
            setTeamIdx(draft.teams.length);
          }}
          className="flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <Plus size={14} />
          Team
        </button>
      </div>

      {team && (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Team name
            </span>
            <input
              value={team.name}
              onChange={(e) => patchTeam({ name: e.target.value })}
              spellCheck={false}
              className={inputCls}
            />
          </label>
          <div>
            <div className="mb-1 grid grid-cols-[1fr_70px_90px_28px] gap-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <span>Player</span>
              <span>#</span>
              <span>Position</span>
              <span />
            </div>
            <div className="space-y-1">
              {team.players.map((p, pi) => (
                <div key={p.id} className="grid grid-cols-[1fr_70px_90px_28px] gap-1">
                  <input
                    value={p.name}
                    spellCheck={false}
                    onChange={(e) =>
                      patchTeam({
                        players: team.players.map((q, qi) =>
                          qi === pi ? { ...q, name: e.target.value } : q
                        ),
                      })
                    }
                    className={inputCls}
                  />
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={p.number ?? ""}
                    onChange={(e) =>
                      patchTeam({
                        players: team.players.map((q, qi) =>
                          qi === pi
                            ? { ...q, number: e.target.value === "" ? undefined : Number(e.target.value) }
                            : q
                        ),
                      })
                    }
                    className={inputCls}
                  />
                  <input
                    value={p.position ?? ""}
                    spellCheck={false}
                    onChange={(e) =>
                      patchTeam({
                        players: team.players.map((q, qi) =>
                          qi === pi ? { ...q, position: e.target.value || undefined } : q
                        ),
                      })
                    }
                    className={inputCls}
                  />
                  <button
                    onClick={() => patchTeam({ players: team.players.filter((_, qi) => qi !== pi) })}
                    className="rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() =>
                patchTeam({ players: [...team.players, { id: freshId("p"), name: "" }] })
              }
              className="mt-2 flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Plus size={13} />
              Add player
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2 border-t border-zinc-100 pt-3">
        <button
          onClick={() => setRosterOpen(false)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            setRosters(draft);
            void saveRosters();
            setRosterOpen(false);
          }}
          className="rounded-md bg-blue-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-900"
        >
          Save roster
        </button>
      </div>
    </Modal>
  );
}
