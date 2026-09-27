import { useEffect, useId, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useBoardDisplay } from "../state/boardDisplay";
import { useEditor } from "../state/store";
import { MAX_PLAYER_SIZE, MIN_PLAYER_SIZE, normalizeDisplayScope, playerOverrides } from "../model/playerDisplay";
import type { DisplayScope } from "../model/playerDisplay";
import { PlayerDisplayOptions } from "./PlayerDisplayOptions";
import { CameraTrackingControls } from "./CameraTrackingControls";
import "./board-display.css";

function ScopeControl({ label, value, onChange }: { label: string; value: DisplayScope; onChange: (value: DisplayScope) => void }) {
  return <label className="board-display-appearance board-display-scope">{label}
    <select value={value} onChange={(event) => onChange(normalizeDisplayScope(event.target.value))}>
      <option value="all">All players</option><option value="involved">Involved</option><option value="supporting">Supporting</option>
    </select>
  </label>;
}

export function BoardDisplayControls() {
  const drill = useEditor((state) => state.drill);
  const options = useBoardDisplay((state) => state.options);
  const setOptions = useBoardDisplay((state) => state.setOptions);
  const applyPreset = useBoardDisplay((state) => state.applyPreset);
  const involvedCount = drill.entities.filter((entity) => entity.kind === "player" && playerOverrides(options, drill.id, entity.id).role === "involved").length;
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<"board" | "players">("board");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  const close = () => { setOpen(false); triggerRef.current?.focus(); };
  return (
    <div ref={rootRef} className="board-display-controls" onKeyDown={(event) => {
      if (event.key === "Escape" && open) { event.stopPropagation(); close(); }
      if (event.key === " " || event.key.startsWith("Arrow")) event.stopPropagation();
    }}>
      <button ref={triggerRef} className="board-display-trigger" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen((value) => !value)}>
        <SlidersHorizontal size={14} aria-hidden="true" />Display
        {(options.playerTrails || options.ballTrail || options.vision) && <span className="board-display-on" aria-label="Coaching overlays enabled" />}
      </button>
      {open && <div id={panelId} className="board-display-panel" role="group" aria-label="Board display">
        <div className="board-display-heading"><strong>Board display</strong><button onClick={close} aria-label="Close board display"><X size={15} aria-hidden="true" /></button></div>
        <div className="board-display-tabs" role="group" aria-label="Display settings">
          <button aria-pressed={section === "board"} onClick={() => setSection("board")}>Board</button>
          <button aria-pressed={section === "players"} onClick={() => setSection("players")}>Players</button>
        </div>
        {section === "players" ? <PlayerDisplayOptions /> : <>
          <div className="board-display-presets">
            <button onClick={() => applyPreset(drill.id, "simple")}>Simple board</button>
            <button disabled={!involvedCount} onClick={() => applyPreset(drill.id, "involved")}>Focus involved</button>
          </div>
          <p className="board-display-preset-hint">Presets reset this drill’s display overrides and keep roles. Assign Involved players on the Players tab.</p>
          <label className="board-display-appearance">Appearance
            <select value={options.appearance} onChange={(event) => setOptions({ appearance: event.target.value === "classic" ? "classic" : "miniatures" })}>
              <option value="miniatures">Miniatures</option><option value="classic">Simple tokens</option>
            </select>
          </label>
          {options.appearance === "miniatures" && <ScopeControl label="Miniatures for" value={options.appearanceScope} onChange={(appearanceScope) => setOptions({ appearanceScope })} />}
          <label className="board-display-size">Player size <output>{Math.round(options.playerSize * 100)}%</output>
            <input type="range" aria-label="Player size" min={MIN_PLAYER_SIZE * 100} max={MAX_PLAYER_SIZE * 100} step={5} value={Math.round(options.playerSize * 100)}
              aria-valuetext={Math.round(options.playerSize * 100) + " percent"} onChange={(event) => setOptions({ playerSize: Number(event.target.value) / 100 })} />
          </label>
          <label className="board-display-appearance">Player labels
            <select value={options.playerLabels} onChange={(event) => setOptions({ playerLabels: event.target.value === "hidden" ? "hidden" : event.target.value === "number" ? "number" : "number-role" })}>
              <option value="number-role">Number + role</option><option value="number">Number only</option><option value="hidden">Hidden</option>
            </select>
          </label>
          <fieldset><legend>Movement trails</legend><div className="board-display-trails">
            <label><input type="checkbox" checked={options.playerTrails} onChange={(event) => setOptions({ playerTrails: event.target.checked })} />Players</label>
            <label><input type="checkbox" checked={options.ballTrail} onChange={(event) => setOptions({ ballTrail: event.target.checked })} />Ball</label>
          </div>
          {options.playerTrails && <ScopeControl label="Player trails for" value={options.trailScope} onChange={(trailScope) => setOptions({ trailScope })} />}
          </fieldset>
          <fieldset><legend>Looking &amp; scanning</legend><div className="board-display-vision">
            <label><input type="checkbox" checked={options.vision} onChange={(event) => setOptions({ vision: event.target.checked })} />Vision cones</label>
            {options.vision && <ScopeControl label="Vision for" value={options.visionScope} onChange={(visionScope) => setOptions({ visionScope })} />}
            <label><input type="checkbox" checked={options.scan} disabled={!options.vision} onChange={(event) => setOptions({ scan: event.target.checked })} />Scanning motion</label>
            {options.vision && options.scan && <ScopeControl label="Scanning for" value={options.scanScope} onChange={(scanScope) => setOptions({ scanScope })} />}
          </div></fieldset>
          <p>Coaching direction, not measured eye tracking. Trails show the last 2 seconds. Display choices also apply to exports.</p>
          <details className="board-display-section">
            <summary>Pitch &amp; camera</summary>
            <label className="board-display-appearance">View
              <select value={options.view} onChange={(event) => setOptions({ view: event.target.value === "portrait" ? "portrait" : event.target.value === "angled" ? "angled" : "landscape" })}>
                <option value="landscape">Landscape</option><option value="portrait">Portrait</option><option value="angled">Angled</option>
              </select>
            </label>
            <label className="board-display-appearance">Pitch
              <select value={options.pitchStyle} onChange={(event) => setOptions({ pitchStyle: event.target.value === "stadium" ? "stadium" : event.target.value === "light" ? "light" : event.target.value === "dark" ? "dark" : "grass" })}>
                <option value="grass">Grass</option><option value="stadium">Stadium</option><option value="light">Light board</option><option value="dark">Dark board</option>
              </select>
            </label>
            <label className="board-display-appearance">Surroundings
              <select value={options.surroundings} onChange={(event) => setOptions({ surroundings: event.target.value === "stadium" ? "stadium" : "none" })}>
                <option value="none">None</option><option value="stadium">Stadium</option>
              </select>
            </label>
            {options.surroundings === "stadium" && <div className="board-display-stadium">
              <label>Stadium label<input type="text" maxLength={40} value={options.stadiumLabel} onChange={(event) => setOptions({ stadiumLabel: event.target.value })} /></label>
              <label>Seat color<input type="color" value={options.stadiumAccent} onChange={(event) => setOptions({ stadiumAccent: event.target.value })} /></label>
            </div>}
            <CameraTrackingControls drill={drill} options={options} onChange={setOptions} />
            <p>Camera tracking runs in Preview and video exports. Editing keeps the full pitch visible.</p>
          </details>
        </>}
      </div>}
    </div>
  );
}
