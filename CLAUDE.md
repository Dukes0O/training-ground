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
- `start-training-ground.bat` — one-click launcher for the coach (`update` arg = reinstall + rebuild)

## Creating or editing drills

Follow **`docs/drill-authoring.md`** (coordinate system, entity kinds, step semantics) and run
`npm run validate` before finishing. The shipped drills in `drills/` are the style reference.
The app picks up file changes live — no restart needed.

## Architecture map

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
- `exports/` is generated output (gitignored). Site bundles for the soccer-quizzes site land there.
