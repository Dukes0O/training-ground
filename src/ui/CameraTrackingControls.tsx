import { useId } from "react";
import type { Drill, Player } from "../model/types";
import { resolveTeamStyles } from "../model/types";
import { MAX_CAMERA_ZOOM, MIN_CAMERA_ZOOM, normalizeCameraTracking } from "../model/cameraTracking";
import type { CameraTrackingOptions } from "../model/cameraTracking";
import "./camera-tracking.css";

interface CameraTrackingControlsProps {
  drill: Drill;
  options: CameraTrackingOptions;
  onChange: (patch: Partial<CameraTrackingOptions>) => void;
}

/** Controlled presentation settings; no writes to the drill or editor selection. */
export function CameraTrackingControls({ drill, options, onChange }: CameraTrackingControlsProps) {
  const id = useId();
  const value = normalizeCameraTracking(options);
  const players = drill.entities.filter((entity): entity is Player => entity.kind === "player");
  const balls = drill.entities.filter((entity) => entity.kind === "ball");
  const teams = resolveTeamStyles(drill);
  const selectedPlayer = players.find((player) => player.id === value.cameraTargetId);
  const following = value.cameraMode !== "full";
  const targetMissing = value.cameraMode === "player" ? !selectedPlayer : value.cameraMode === "ball" && balls.length === 0;
  return (
    <fieldset className="camera-tracking-controls">
      <legend>Camera</legend>
      <label className="camera-tracking-row">Framing
        <select value={value.cameraMode} onChange={(event) => {
          const cameraMode = event.target.value === "ball" ? "ball" : event.target.value === "player" ? "player" : "full";
          onChange({ cameraMode });
        }}>
          <option value="full">Full pitch</option>
          <option value="ball" disabled={!balls.length}>Follow ball</option>
          <option value="player" disabled={!players.length}>Follow player</option>
        </select>
      </label>
      {value.cameraMode === "player" && <label className="camera-tracking-row">Player
        <select value={selectedPlayer ? selectedPlayer.id : ""} onChange={(event) => onChange({ cameraTargetId: event.target.value })}>
          <option value="">Choose a player</option>
          {players.map((player) => <option key={player.id} value={player.id}>
            {teams[player.team].label}{player.number !== undefined ? ` ${player.number}` : ""} · {player.name || player.position || player.id}
          </option>)}
        </select>
      </label>}
      <label className="camera-tracking-zoom" htmlFor={`${id}-zoom`}>
        <span>Follow zoom <output htmlFor={`${id}-zoom`}>{value.cameraZoom.toFixed(1)}×</output></span>
        <input id={`${id}-zoom`} type="range" min={MIN_CAMERA_ZOOM} max={MAX_CAMERA_ZOOM} step={0.1}
          value={value.cameraZoom} disabled={!following} aria-valuetext={`${value.cameraZoom.toFixed(1)} times`}
          onChange={(event) => onChange({ cameraZoom: Number(event.target.value) })} />
      </label>
      <p className="camera-tracking-hint">{targetMissing
        ? "Choose an available target to follow. The full pitch stays visible until then."
        : following
          ? "Gently follows the action during playback and exports. A hidden target returns to the full pitch."
          : "Show the whole pitch, or follow the ball or a player."}
        {value.cameraMode === "ball" && balls.length > 1 && ` This drill has ${balls.length} balls; the camera follows ${balls[0].id}.`}
      </p>
    </fieldset>
  );
}
