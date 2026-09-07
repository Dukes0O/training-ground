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

The bundled library has 12 starter drills. The **Describe a drill** dialog prepares a coaching
brief for the user to copy into a Codex task in this repository. It stores the draft in the
browser and supplies authoring and validation instructions. There is no model API or speech
recognition integration; the user may use device dictation in the form.

## Architecture map

- `src/App.tsx` — workspace shell with library, saved-drill, and tactics-board views. View and coaching-panel state are local React state; leaving the board pauses playback. The coaching panel shows drill notes or the existing inspector.
- `src/library/LibraryPanel.tsx` — visual cards with real BoardSvg previews, search, all-tag filtering, sorting, duplicate/trash actions, and browser-local saved-drill IDs. Preview requests are cached by file revision/update time; the open drill uses live editor state.
- `src/ui/CoachBriefDialog.tsx` — coaching objective and session context → a readable prompt copied to Codex. Native dialog, local draft, clipboard success/fallback; no direct model calls.
- `src/ui/ToolRail.tsx` and `src/timeline/Timeline.tsx` — grouped board tools and sequence/playback controls. Step cards support drag reorder and Alt+Left/Right keyboard reorder.
- `src/ui/Modal.tsx` and `src/ui/useHotkeys.ts` — native modal focus handling and board-only shortcuts. A modal without onClose requires an explicit action; shortcuts respect focused controls and active dialogs/exports.
- `src/index.css`, `src/ui/editor-workspace.css`, and `src/ui/coach-brief.css` — responsive workspace, editor, and scoped brief-dialog styles. BoardSvg remains separate from application chrome.
- `src/model/types.ts` — data model (meters everywhere); `schema.ts` is its zod mirror (keep in sync — a compile-time check enforces it)
- `src/model/resolve.ts` — sparse→dense pose resolution; everything that draws goes through it
- `src/board/BoardSvg.tsx` — THE renderer. Pure function of a snapshot; the editor mounts it live and exports rasterize the same component. Keep it free of external refs/webfonts/foreignObject
- `src/state/store.ts` — zustand store (undo via zundo; only `drill` is history-tracked)
- `src/api/persistence.ts` — autosave, SSE reload, conflict handling (async lives here, not in the store)
- `server/` — dumb file layer: drills/rosters/settings CRUD, SSE watch, exports writes; no validation server-side

## Conventions

- Units are meters; 1 SVG user unit = 1 m; origin = pitch top-left; 3 m apron is legal space.
- Drill `id` === filename slug; server writes are atomic (tmp + rename); deletes go to `data/trash/`.
- The server stamps `rev`/`createdAt`/`updatedAt` — never hand-edit those.
- Browser bookmarks and coaching-brief drafts are convenience state, not drill data. Their storage is optional; drill files remain the source of truth.
- `exports/` is generated output (gitignored). Site bundles for the soccer-quizzes site land there.
- The architecture atlas (`docs/project_atlas`, served at `/atlas`) documents components, flows
  and accepted decisions — when your change adds/renames components or overturns a decision,
  update `docs/project_atlas/data/*.json` and run `npm run atlas`. Notably: drills stay JSON
  files (no SQLite) — see the `files_not_sqlite` decision before adding storage.
