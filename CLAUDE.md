# Training Ground

Local-first soccer drill designer & animator for a youth coach. React + TypeScript + Vite SPA
with an SVG tactics board; a small Express server (`server/*.mjs`, plain JS, no build step)
serves the built app on `http://127.0.0.1:8123` and does file CRUD. Drills are one JSON file
each under `drills/` — that folder is the database.

## Commands

- `npm run dev` — Vite dev server (proxies `/api` to :8123; run `npm start` in another shell for the API)
- `npm run build` — type-check + production build to `dist/`
- `npm start` — serve `dist/` + API on :8123 and open the browser
- `npm run validate [-- drills/x.json]` — validate drill files (always run after editing drills)
- `npm run schema` — regenerate `schema/drill.schema.json` from `src/model/schema.ts`
- `npm run atlas` — regenerate the architecture atlas bundle from `docs/project_atlas/data/*.json`
- `start-training-ground.bat` — one-click launcher for the coach (`update` arg = reinstall + rebuild)

## Creating or editing drills

Follow **`docs/drill-authoring.md`** (coordinate system, entity kinds, step semantics) and run
`npm run validate` before finishing. The shipped drills in `drills/` are the style reference.
The app picks up file changes live — no restart needed.

The bundled library has 12 starter drills. Support both manual creation/editing on the board
and coaching goals dictated directly in a Codex task in this repository. Both paths work on
the same drill files, and the running app reloads file changes. **Describe a drill** explains
these paths and offers an optional written-brief helper; using that form is not required.

Project constraint: do not add paid AI or speech API integrations unless the user explicitly
asks later. Dictation happens in Codex itself, not through a Training Ground speech service.

## Architecture map

- `src/App.tsx` — workspace shell with library, saved-drill, and tactics-board views. View and coaching-panel state are local React state; leaving the board pauses playback. The coaching panel shows drill notes or the existing inspector.
- `src/library/LibraryPanel.tsx` — visual cards with real BoardSvg previews, search, all-tag filtering, sorting, duplicate/trash actions, and browser-local saved-drill IDs. A WeakMap caches previews by refreshed summary object, so agent edits refresh previews even when revision fields stay the same. The open drill uses live editor state.
- `src/ui/CoachBriefDialog.tsx` — explains direct Codex requests and manual board editing, with an onOpenBoard callback. An optional expandable form prepares a written brief. Native dialog, local draft, clipboard success/fallback; no direct model or speech calls.
- `src/ui/ToolRail.tsx` and `src/timeline/Timeline.tsx` — grouped board tools and sequence/playback controls. Step cards support drag reorder and Alt+Left/Right keyboard reorder.
- `src/ui/Modal.tsx` and `src/ui/useHotkeys.ts` — native modal focus handling and board-only shortcuts. A modal without onClose requires an explicit action; shortcuts respect focused controls and active dialogs/exports.
- `src/index.css`, `src/ui/editor-workspace.css`, and `src/ui/coach-brief.css` — responsive workspace, editor, and scoped brief-dialog styles. BoardSvg remains separate from application chrome.
- `src/model/types.ts` — data model (meters everywhere); `schema.ts` is its zod mirror (keep in sync — a compile-time check enforces it)
- `src/board/annotations/ZoneGlyph.tsx` and `src/model/annotationGeometry.ts` — zones use optional `shape` rectangle/ellipse/polygon. Rectangle is the default; circles are equal ellipse dimensions. Polygons use `points` in pitch meters; rectangle/ellipse use `rect`. Tools and Edit details expose the geometry. Bounds are global; only visibility varies by step. Arrow `pathMode` chooses smooth or straight waypoint connections.
- `src/model/duplicateSelection.ts` — duplicates selected entities and their sparse choreography, translates absolute points, remaps internal anchors, and retains links to unselected targets. The store applies one undoable edit and uses the returned ID map to copy browser-local player roles/overrides.
- `src/model/resolve.ts` — sparse→dense pose resolution; everything that draws goes through it
- `src/model/boardDisplay.ts` — `sceneWithDisplay` / `stepWithDisplay` wrap the resolver with appearance and deterministic coaching overlays. Trails break at instant resets and visibility changes; they do not depend on playback history.
- `src/model/vision.ts` and `src/board/VisionCones.tsx` — illustrative vision sectors and deterministic scanning. Existing `pose.rotation` supplies the coach-set look direction (including 0°); otherwise the overlay uses travel heading. Edit details exposes Look direction and Look angle. This is coaching intent, not measured gaze.
- `src/model/boardCamera.ts` — shared Landscape/Portrait/Angled projections, inverse pointer mapping, pitch palettes, and export bounds. Angled is an affine SVG projection, not a 3D engine. Miniature figures, balls, and labels remain upright; drill positions stay in meters.
- `src/model/cameraTracking.ts` and `src/ui/CameraTrackingControls.tsx` — full-pitch, half-pitch, attacking-third, follow-ball, or chosen-player framing at 1–3× zoom. Weighted timeline samples provide gentle look-ahead without prior-frame state; reset and visibility boundaries prevent sweeps across teleports. Missing/hidden targets use the full pitch. `snapshot.cameraBounds` keeps the projected aspect ratio, including stadium surroundings and player-size padding, constant through playback and exports.
- `stepWithDisplay` retains fixed half-pitch/attacking-third bounds; only following-camera bounds clear so editing and Edit-mode PNG show the full pitch. Preview-mode PNG captures the current playhead through `sceneWithDisplay`; video/GIF frames use its tracked camera. Output aspect stays fixed across both modes.
- `src/board/StadiumSurroundings.tsx` — original SVG stands, lights, and pitch-side boards with a browser-local label and accent. Surroundings are optional and separate from the Stadium pitch palette; shared projected bounds include them in exports.
- `src/model/playerDisplay.ts` — resolves All/Involved/Supporting scopes and individual overrides for appearance, trails, vision, and scanning. Global switches win over overrides, and scanning needs a visible vision cone. Players start unassigned. Size defaults to 0.5, bounded to 0.3–1.1. Number-only labels and a smaller ball keep crowded areas readable.
- `src/state/boardDisplay.ts` — `useBoardDisplay` stores browser-local appearance, camera, pitch style, stadium, size, scopes, and separate trail/vision/scan preferences. `drillPlayers` keys roles and overrides by drill ID and player ID. Defaults: Miniatures at 50%, number-only labels, Landscape, Grass, Full pitch, no stadium, all overlays off. These settings never enter drill JSON or undo history.
- `src/ui/BoardDisplayControls.tsx`, `src/ui/PlayerDisplayOptions.tsx`, and `src/ui/board-display.css` — Display has Board and Players tabs. Board sets appearance, label mode, size, and feature scopes; Pitch & camera expands view, surroundings, and tracking settings. Simple board/Focus involved presets retain roles and reset this drill's overrides. Players assigns roles and overrides; Use selected players marks selected players Involved and all others Supporting. Scanning needs Vision cones. These cues illustrate coaching direction, not measured eye tracking.
- `src/board/BoardSvg.tsx` — THE renderer. Pure function of a snapshot; the editor mounts it live and exports rasterize the same component. Bundled miniature artwork is embedded in shared SVG definitions; keep the renderer free of external image references, webfonts, and foreignObject. Camera-frame clipping prevents content leaking into letterboxing. Actors draw in projected depth order; size never changes pitch coordinates.
- `src/board/entities/miniatureAssets.tsx` — shared SVG definitions embed `src/assets/miniature-players.webp` as a data URI. The PNG source at `src/assets/miniature-players.png` was created with the built-in ImageGen tool and is retained alongside the smaller runtime WebP. `PlayerToken.tsx` places the artwork; `BallGlyph.tsx` draws the detailed ball in SVG. There is no runtime image-generation service.
- `src/state/store.ts` — zustand store (undo via zundo; only `drill` is history-tracked)
- `src/api/persistence.ts` — autosave, SSE reload, conflict handling (async lives here, not in the store)
- `server/` — dumb file layer: drills/rosters/settings CRUD, SSE watch, exports writes; no validation server-side

## Conventions

- Units are meters; 1 SVG user unit = 1 m; origin = pitch top-left; 3 m apron is legal space.
- Drill `id` === filename slug; server writes are atomic (tmp + rename); deletes go to `data/trash/`.
- The server stamps `rev`/`createdAt`/`updatedAt` — never hand-edit those.
- Browser bookmarks and coaching-brief drafts are convenience state, not drill data. Their storage is optional; drill files remain the source of truth.
- Appearance, view/camera, pitch/stadium, player size/roles/overrides, light trails, vision cones, and scanning are display preferences. Keep them out of the drill schema. Export jobs capture these preferences at their start and use the same display resolver and projected bounds as the board. Polygon points and arrow pathMode are drill content. Never describe vision cones as measured tracking data.
- `exports/` is generated output (gitignored). Site bundles for the soccer-quizzes site land there.
- The architecture atlas (`docs/project_atlas`, served at `/atlas`) documents components, flows
  and accepted decisions — when your change adds/renames components or overturns a decision,
  update `docs/project_atlas/data/*.json` and run `npm run atlas`. Notably: drills stay JSON
  files (no SQLite) — see the `files_not_sqlite` decision before adding storage.
