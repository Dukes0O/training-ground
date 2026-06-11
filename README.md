# Training Ground

Local soccer drill designer & animator for youth coaching. Design drills on a tactics board,
animate them step by step, and export images, GIFs, MP4 video, narrated coaching clips, and
ready-to-post bundles for the team site — all on your own machine, no accounts, no cloud.

## Run it

Double-click **`start-training-ground.bat`**. The first run installs dependencies and builds
the app (a few minutes, one time); after that it starts in seconds and opens your browser at
`http://127.0.0.1:8123`. Keep the console window open while you use the app.

After pulling new code: run `start-training-ground.bat update`.

Use **Chrome or Edge** — video export and narrated recording rely on Chromium APIs
(WebCodecs, Region Capture).

## What it does

- **Tactics board** — 11v11, 9v9, 8v8, half-pitch and resizable training-grid formats. Place and
  drag players (number, name, position label), ball(s), cones, flat markers, mini goals,
  ladders, mannequins, poles, hurdles.
- **Coaching notation** — pass (solid), run (dashed), dribble (wavy) and shot (thick) arrows;
  endpoints snap to players and follow their runs; shaded zones; text labels; everything can be
  scoped to specific steps and fades in/out during playback.
- **Animation** — keyframe steps with per-step move time, coaching-beat pauses, easing and
  curved run paths. Play, scrub, loop, half/1.5× speed.
- **Library** — every drill is one JSON file under `drills/`; search and tag-filter with live
  mini-board previews. Deleted drills go to `data/trash/` (restore from the library's trash
  button). Team roster lives in the roster dialog; "fill from roster" stamps a kid's
  name/number/position onto a token.
- **Exports** (Export menu) — snapshot PNG (1920 px), MP4 video (H.264; WebM fallback), GIF,
  and **Site bundle**: PNG + GIF + MP4 + drill JSON + `manifest-snippet.json` +
  `AGENT-INSTRUCTIONS.md`, assembled under `exports\<drill>\site-bundle\` for handing to the
  agent that maintains the soccer-quizzes site.
- **Narrated takes** (Record button) — record the board plus your voice while you play and
  scrub the drill. Saves `narration-<date>.mp4` (or `.webm`) next to the other exports.

## Keyboard

Space play/pause · `,` / `.` previous/next step · arrows nudge selection (Shift = bigger) ·
Delete remove · Esc back to select tool · Ctrl+Z / Ctrl+Y undo/redo · Ctrl+S save now

## Agents (Claude Code / Codex)

Drills are plain JSON; the app picks up file changes within a second. Open an agent in this
repo and ask for a drill — see **`docs/drill-authoring.md`** (canonical format guide),
`AGENTS.md`, and `CLAUDE.md`. Validate with `npm run validate` before finishing.

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
