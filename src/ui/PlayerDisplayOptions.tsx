import { useEffect, useState } from "react";
import { useEditor } from "../state/store";
import { useBoardDisplay } from "../state/boardDisplay";
import { playerOverrides } from "../model/playerDisplay";
import type { PlayerDisplayOverrides } from "../model/playerDisplay";

export function PlayerDisplayOptions() {
  const drill = useEditor((state) => state.drill);
  const selection = useEditor((state) => state.selection);
  const options = useBoardDisplay((state) => state.options);
  const setPlayerOptions = useBoardDisplay((state) => state.setPlayerOptions);
  const assignInvolvedPlayers = useBoardDisplay((state) => state.assignInvolvedPlayers);
  const players = drill.entities.filter((entity) => entity.kind === "player");
  const selected = players.filter((player) => selection.includes(player.id));
  const selectionKey = selected.map((player) => player.id).join("\0");
  const [target, setTarget] = useState("@selection");
  useEffect(() => { setTarget("@selection"); }, [drill.id, selectionKey]);
  const targets = target === "@selection" && selected.length ? selected : players.filter((player) => player.id === target);
  const active = targets.length ? targets : players.slice(0, 1);
  const ids = active.map((player) => player.id);
  const values = active.map((player) => playerOverrides(options, drill.id, player.id));
  const common = (key: keyof PlayerDisplayOverrides, fallback: string) => {
    const first = values[0]?.[key] ?? fallback;
    return values.every((value) => (value[key] ?? fallback) === first) ? first : "mixed";
  };
  const patch = (value: PlayerDisplayOverrides) => setPlayerOptions(drill.id, ids, value);
  const involvedCount = players.filter((player) => playerOverrides(options, drill.id, player.id).role === "involved").length;
  const supportingCount = players.filter((player) => playerOverrides(options, drill.id, player.id).role === "supporting").length;

  if (!players.length) return <p>Add a player to set player display options.</p>;
  return <div className="player-display-options">
    <p className="player-display-intro">Choose who leads this drill. Roles apply to this drill in this browser.</p>
    <button className="board-display-action" disabled={!selected.length} onClick={() => assignInvolvedPlayers(drill.id, players.map((player) => player.id), selected.map((player) => player.id))}>
      Use selected players{selected.length ? ` (${selected.length})` : ""}
    </button>
    <p className="player-display-hint">Makes selected players Involved and everyone else Supporting. Select players on the board first.</p>
    <div className="player-display-counts">{involvedCount} involved · {supportingCount} supporting · {players.length - involvedCount - supportingCount} unassigned</div>
    <label className="player-display-target">Player
      <select value={target === "@selection" && selected.length ? "@selection" : active[0]?.id ?? ""} onChange={(event) => setTarget(event.target.value)}>
        {selected.length > 0 && <option value="@selection">Selected players ({selected.length})</option>}
        {players.map((player) => <option key={player.id} value={player.id}>{[player.number != null ? `#${player.number}` : "", player.position, player.name].filter(Boolean).join(" · ") || player.id} ({drill.teams?.[player.team]?.label ?? player.team})</option>)}
      </select>
    </label>
    <label className="board-display-appearance">Role
      <select value={common("role", "unassigned")} onChange={(event) => patch({ role: event.target.value === "involved" ? "involved" : event.target.value === "supporting" ? "supporting" : undefined })}>
        <option value="unassigned">Unassigned</option><option value="involved">Involved</option><option value="supporting">Supporting</option><option value="mixed" disabled>Mixed roles</option>
      </select>
    </label>
    <label className="board-display-appearance">Appearance
      <select value={common("appearance", "inherit")} onChange={(event) => patch({ appearance: event.target.value as PlayerDisplayOverrides["appearance"] })}>
        <option value="inherit">Use scope</option><option value="miniatures">Miniature</option><option value="classic">Simple token</option><option value="mixed" disabled>Mixed choices</option>
      </select>
    </label>
    {([ ["trail", "Trail"], ["vision", "Vision cone"], ["scan", "Scanning"] ] as const).map(([key, label]) => <label key={key} className="board-display-appearance">{label}
      <select value={common(key, "inherit")} onChange={(event) => patch({ [key]: event.target.value })}>
        <option value="inherit">Use scope</option><option value="on">On</option><option value="off">Off</option><option value="mixed" disabled>Mixed choices</option>
      </select>
    </label>)}
    <p>Global switches on the Board tab still apply. Scanning also needs a vision cone. Unassigned players receive these effects only under All players, unless you override them.</p>
    <button className="board-display-action board-display-action-subtle" onClick={() => patch({ appearance: "inherit", trail: "inherit", vision: "inherit", scan: "inherit" })}>Reset display overrides{ids.length > 1 ? ` (${ids.length})` : ""}</button>
  </div>;
}
