# Training Ground

Local soccer drill designer and animator for youth coaching. Browse a visual drill library,
save ideas for your next practice, and open a tactics board to adapt and animate them. Export
images, GIFs, MP4 video, narrated coaching clips, and bundles for the team site on your own
machine. The app needs no account or cloud service.

## Run it

Double-click **`start-training-ground.bat`**. The first run installs dependencies and builds
the app (a few minutes, one time); after that it starts in seconds and opens your browser at
`http://127.0.0.1:8123`. Keep the console window open while you use the app.

After pulling new code: run `start-training-ground.bat update`.

Use **Chrome or Edge** — video export and narrated recording rely on Chromium APIs
(WebCodecs, Region Capture).

## What it does

- **Drill library** — start with 12 animated drills covering ball mastery, passing, possession,
  defending, transition, and finishing. Visual cards show the starting setup, players, steps,
  and demo length. Search titles, descriptions, and tags; filter by any topic; sort by name
  or recent updates. Demo length is animation time, not the length of your practice.
- **Saved drills** — bookmark your favourites and open them from the sidebar. Bookmarks stay
  in this browser; the drill files remain in `drills/`. Duplicate a drill to make a variation,
  or move it to trash and restore it from **Recently deleted**.
- **Tactics board** — 11v11, 9v9, 8v8, half-pitch and resizable training-grid formats. Place and
  drag players (number, name, position label), ball(s), cones, flat markers, mini goals,
  ladders, mannequins, poles, and hurdles from the grouped tool palette. Read **Coach’s notes**
  beside the board, or switch to **Edit details** to change the drill or a selected piece.
- **Coaching notation** — pass (solid), run (dashed), dribble (wavy) and shot (thick) arrows;
  endpoints snap to players and follow their runs; shaded zones; text labels; everything can be
  scoped to specific steps and fades in/out during playback.
- **Animation** — keyframe steps with per-step move time, coaching-beat pauses, easing and
  curved run paths. The sequence strip groups playback, speed, step order, and timing controls.
  Select a step to explain it, drag to reorder, or use Alt+Left/Right on a focused step.
- **Team roster** — manage players from the sidebar. Fill a token from the roster, or place
  a team using a formation preset.
- **Exports** (Export menu) — snapshot PNG (1920 px), MP4 video (H.264; WebM fallback), GIF,
  and **Site bundle**: PNG + GIF + MP4 + drill JSON + `manifest-snippet.json` +
  `AGENT-INSTRUCTIONS.md`, assembled under `exports\<drill>\site-bundle\` for handing to the
  agent that maintains the soccer-quizzes site.
- **Narrated takes** (Record button) — record the board plus your voice while you play and
  scrub the drill. Saves `narration-<date>.mp4` (or `.webm`) next to the other exports.

## Create drills your way

- **Talk to Codex** — dictate your coaching goals directly in a Codex task opened in this
  repository. Explain what players should learn, plus any age, player, space, or time limits.
  Codex can create or change the drill files. The running app reloads file changes so you can
  review the result on the board.
- **Build on the board** — choose **New drill**, or open an existing drill, and create or edit
  it yourself. Place players and equipment, add movement steps, and adjust the coaching notes.

Both paths use the same JSON drill files. You can ask Codex for a first version, adjust it
manually, and ask Codex for further changes. If a file changes while you have unsaved edits,
the app asks which version to keep.

**Describe a drill** explains these two paths. Its optional written-brief helper lets you
organize an objective and session details, review the prompt, and copy it into Codex. You can
skip the form and speak to Codex directly. The helper keeps a browser draft when storage is
available and offers selectable text if copying is blocked.

Training Ground has no paid AI or speech API integration. Dictate in Codex itself; the app
remains the place to browse, edit, and play the drills.

## Keyboard

Space play/pause · `,` / `.` previous/next step · arrows nudge selection (Shift = bigger) ·
Delete remove · Esc back to select tool · Ctrl+Z / Ctrl+Y undo/redo · Ctrl+S save now

Board shortcuts run while the tactics board is open. They pause in forms, modal dialogs, and
exports. Space still activates a focused button. Dialogs keep keyboard focus inside and
return it when closed; Escape closes dismissible dialogs.

## Privacy note (public repo)

`data/rosters.json` and `data/settings.json` are gitignored — the roster holds your players'
names and stays on your machine. **Drill files in `drills/` are committed and public**: if you
stamp roster names onto players in a drill you intend to push, prefer first names, initials, or
numbers only.

## Agents (Claude Code / Codex)

Drills are plain JSON; the app picks up file changes within a second. Open an agent in this
repo and ask for a drill — see **`docs/drill-authoring.md`** (canonical format guide),
`AGENTS.md`, and `CLAUDE.md`. Validate with `npm run validate` before finishing.

## Architecture atlas

An interactive map of how the app fits together — components, data flows, deep dives, and the
design decisions agents should preserve — lives at **http://127.0.0.1:8123/atlas** while the app
runs (or open [docs/project_atlas/index.html](docs/project_atlas/index.html) straight from disk).
Maintained from `docs/project_atlas/data/*.json` via `npm run atlas`.

## Develop

```
npm run dev        # Vite dev server (run `npm start` too for the API)
npm run build      # type-check + production build into dist/
npm start          # serve dist/ + API on http://127.0.0.1:8123 and open the browser
npm test           # vitest (animation resolver, tweening, serializer)
npm run validate   # check drill files (structure + semantics)
npm run schema     # regenerate schema/drill.schema.json from the zod schema
```

Module map and conventions: `CLAUDE.md`. Data model source of truth:
[src/model/types.ts](src/model/types.ts) with its zod mirror in
[src/model/schema.ts](src/model/schema.ts).

## Folders

```
drills/      the drill library (one JSON per drill — this is the database)
data/        rosters.json, settings.json, trash/
exports/     generated PNG/GIF/MP4/narrations + site-bundle/ (gitignored)
docs/        drill-authoring.md — the agent/author guide
server/      local Express file server (port 8123)
src/         React app
```

## Troubleshooting

- **Mic or screen-share blocked** — click the lock icon by the address bar and allow
  microphone for `127.0.0.1`; for recording, pick *this tab* in the share dialog.
- **Video export says no encoder** — Windows "N" editions lack media codecs; install the
  Media Feature Pack, or use the WebM/GIF exports which always work.
- **Port 8123 busy** — the server probes 8124-8130 automatically and prints the URL it chose.
- **Sluggish playback in a background tab** — by design the clock keeps time (coarsely) when
  the tab is hidden; bring the tab forward for smooth frames.
