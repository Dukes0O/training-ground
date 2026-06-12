# Training Ground Atlas

A static architecture atlas for the drill app: how the system fits together, how data flows,
which design decisions are load-bearing, and deep dives into the questions that matter
(the single render path, the agent route, the animation resolver, the export pipeline,
why files instead of SQLite, the meters-based geometry).

## Open it

- With the app running: **http://127.0.0.1:8123/atlas**
- Or open `docs/project_atlas/index.html` straight from disk — the data is embedded in
  `atlas-data.js`, so no server is needed.

Deep links: `?view=overview|graph|flows|dives|decisions`, `?dive=<id>` (e.g.
`?dive=files_not_db`), `?node=<component-id>` pins a component on the architecture map.

## Views

- **Architecture** — pan/zoom dependency map. Hover or click a component: blue = feeds it,
  amber = consumes it; the inspector lists files, relationships, and the decisions/dives that
  touch it. Search (top right) highlights matches.
- **Data Flows** — the three loops narrated step by step: the edit loop (drag → file),
  the agent route (file → library), the export pipeline (frames → media → site bundle).
- **Deep Dives** — one hard question each, with "Show on the architecture map".
- **Decisions** — accepted judgments agents should preserve (including the SQLite verdict),
  each with "Show on map".

## Maintenance (for agents)

The sources of truth are the JSON files in `data/`:

- `architecture.graph.json` — lanes, components (id/label/lane/x/y/summary/files/details), edges
- `dataflow.json` — the narrated flows
- `deep_dives.json` — dive narratives (`highlights` = node ids, `decisions` = decision ids)
- `decisions.json` — decision records (`touches` = node ids)
- `overview.json` — the overview page

After editing them run `npm run atlas` to regenerate `atlas-data.js` (never hand-edit it).
If `app.js` or `styles.css` change, bump their `?v=` query in `index.html` so cached copies
refresh. When you rename or remove a node id, check `deep_dives.json` and `decisions.json` for
references — a stale id silently highlights nothing.

Keep entries short: the atlas orients, the code and `docs/drill-authoring.md` carry detail.
