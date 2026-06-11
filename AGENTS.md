# Agent guide — Training Ground

The most common task here: **author or edit a drill**. Drills are single JSON files in
`drills/`; the filename (minus `.json`) must equal the file's `id`. The running app picks up
changes within a second — don't restart anything.

1. Read **`docs/drill-authoring.md`** — coordinate system (meters, origin top-left), entity
   kinds, step/animation semantics, checklist.
2. Use the shipped drills in `drills/` as the style reference (`9v9-build-out.json` shows
   sparse steps; `4v1-rondo.json` shows zones + arrows on a resized grid).
3. Start files with `"$schema": "../schema/drill.schema.json"`.
4. Finish with `npm run validate -- drills/<file>.json` and fix anything it reports.

For app code (React/TS SPA + Express file server), see CLAUDE.md for the module map and
conventions. Build with `npm run build`; never hand-edit `rev`/`createdAt`/`updatedAt` in
drill files (the server stamps them).
