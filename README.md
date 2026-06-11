# Training Ground

Local soccer drill designer & animator for youth coaching. Design drills on a tactics board,
animate them step by step, and export images/video/GIF for the team site.

## Run it

Double-click **`start-training-ground.bat`**. First run installs dependencies and builds the app
(a few minutes, one time); after that it starts in seconds and opens your browser at
`http://127.0.0.1:8123`. Keep the console window open while you use the app.

To pull in updated code later: run `start-training-ground.bat update`.

## Develop

```
npm run dev      # Vite dev server (proxies /api to the local server on 8123)
npm run build    # type-check + production build into dist/
npm start        # serve dist/ + API on http://127.0.0.1:8123 and open the browser
```

Drills live as one JSON file each under `drills/` — see `docs/drill-authoring.md` (arrives with
the library milestone) for the format. Agents (Claude Code / Codex) are welcome to author drill
files directly; the app picks up changes live.
