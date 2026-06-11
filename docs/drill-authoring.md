# Authoring drills (for agents and humans)

A drill is **one JSON file** in `drills/`. The filename (minus `.json`) **must equal the `id`
field**: `drills/4v1-rondo.json` → `"id": "4v1-rondo"`. Ids are lowercase letters, digits and
dashes only. The app watches the folder — a valid file appears in the library within a second
of being written, no restart needed.

Before finishing any drill work, run:

```
npm run validate                      # all drills
npm run validate -- drills/my-drill.json
```

The JSON Schema lives at `schema/drill.schema.json`; start every file with
`"$schema": "../schema/drill.schema.json"` so editors validate as you type.
The four shipped drills in `drills/` are the style reference — read one before writing.

## Coordinate system

Everything is in **meters**. The origin is the pitch's **top-left corner**; `x` runs along the
length of the pitch (left goal line → right goal line), `y` runs down across the width.
A 3 m apron surrounds the pitch and is legal standing room (so `x: -2` is just off the end).

```
(0,0) ─────────── x ──────────→ (length, 0)
  │   ┌─────────────────────┐
  │   │ ╔══╗            ╔══╗│   "home" attacks left → right
  y   │ ║PA║     ○      ║PA║│   "away" defends the right goal
  │   │ ╚══╝            ╚══╝│
  ↓   └─────────────────────┘
(0, width)              (length, width)
```

Pitch formats (`pitch` field): `"11v11"` (100×64), `"9v9"` (70×50), `"8v8"` (60×40),
`"half-11v11"` (50×64, goal at x=0), `"grid"` (40×30 blank training area).
Resize the grid for small-sided work:
`"pitch": { "format": "grid", "overrides": { "length": 15, "width": 15 } }`.

## Entities

Declared once in `entities`, positioned per step in `steps[k].positions` keyed by entity id.

| kind | required | optional | notes |
|---|---|---|---|
| `player` | `id`, `team` (`home`/`away`/`neutral`) | `number` (0–99), `name`, `position` (`"GK"`, `"CM"`, …) | label renders under the token |
| `ball` | `id` | | usually id `"ball"` |
| `cone`, `flat`, `minigoal`, `ladder`, `mannequin`, `pole`, `hurdle` | `id` | `color` (hex) | training equipment |
| `arrow` | `id`, `from`, `to` | `style`, `via`, `color`, `fromStep`, `toStep` | coaching notation, see below |
| `zone` | `id`, `rect` (`{x,y,w,h}`) | `color`, `text`, `fromStep`, `toStep` | shaded area |
| `label` | `id`, `text` | `color`, `fromStep`, `toStep` | free text; position it via `positions` |

**Arrows** use coaching notation via `style`: `pass` (solid), `run` (dashed), `dribble` (wavy),
`shot` (thick). Endpoints `from`/`to` are either a point `{ "x": 10, "y": 5 }` or an anchor
`{ "ref": "entity-id" }` that **tracks the entity while it moves**. `via` adds curve waypoints.

**Visibility**: annotations show from `fromStep` through `toStep` (inclusive step indexes).
Omit both to show on every step. A pass arrow for step 2 → `"fromStep": 2, "toStep": 2`.

## Steps and animation

`steps[0]` is the starting picture. Each later step is a keyframe; **`durationMs` is the time
animating INTO that step from the previous one** (default 2000). `pauseAfterMs` freezes on the
arrived pose — use it as a coaching beat (default 300).

Per-entity pose fields: `x`, `y` plus optional `rotation` (degrees), `via` (waypoints traversed
on the way into this step, smoothed through a curve), `ease` (`linear` | `easeIn` | `easeOut` |
`easeInOut` | `instant`), `hidden`. Passes read best with `"ease": "linear"`; runs default to
easeInOut.

**Sparse steps are legal and encouraged for hand-written files**: list only the entities that
move; everything else forward-fills from the last step that placed it. An entity with no pose
in any step at-or-before step k simply isn't on the board yet — that's how you introduce a
late runner. (`drills/9v9-build-out.json` demonstrates sparse style; the app saves files back
in dense form, one full snapshot per step.)

## Minimal complete example

```json
{
  "$schema": "../schema/drill.schema.json",
  "schemaVersion": 1,
  "id": "wall-pass",
  "title": "Wall pass",
  "description": "Give-and-go around a mannequin.",
  "tags": ["passing"],
  "pitch": { "format": "grid", "overrides": { "length": 20, "width": 15 } },
  "entities": [
    { "kind": "player", "id": "p1", "team": "home", "number": 7 },
    { "kind": "player", "id": "p2", "team": "home", "number": 9 },
    { "kind": "mannequin", "id": "dummy" },
    { "kind": "ball", "id": "ball" }
  ],
  "steps": [
    { "name": "Setup", "positions": {
      "p1": { "x": 4, "y": 7.5 }, "p2": { "x": 10, "y": 4 },
      "dummy": { "x": 9, "y": 8 }, "ball": { "x": 5, "y": 7.5 } } },
    { "name": "Pass and go", "durationMs": 1400, "positions": {
      "ball": { "x": 10, "y": 4.8, "ease": "linear" },
      "p1": { "x": 12, "y": 9, "via": [{ "x": 8, "y": 10 }] } } },
    { "name": "Return ball in behind", "durationMs": 1200, "pauseAfterMs": 600, "positions": {
      "ball": { "x": 13, "y": 8.6, "ease": "linear" } } }
  ]
}
```

## Pre-flight checklist

1. Filename equals `id`; id is a valid slug (no spaces, no uppercase).
2. Every key in every `positions` map matches an entity id exactly.
3. Coordinates are meters inside the pitch (plus the 3 m apron) — **not pixels**.
4. Every non-annotation entity has a pose in `steps[0]` (or deliberately enters later).
5. Arrows have both endpoints; anchored refs point at real entity ids.
6. `fromStep`/`toStep` are within range and `fromStep ≤ toStep`.
7. `npm run validate -- drills/<file>.json` passes with no errors.

## Common mistakes

- Pixel-scale numbers (`"x": 450`) — the board is ~15–100 m across; tokens will be invisible.
- Duplicate entity ids, or a `positions` key that doesn't match any entity (it gets dropped).
- Forgetting that `durationMs` belongs to the step being animated INTO, not out of.
- Re-declaring an unchanged player in every step of a hand-written file — allowed (the app does
  it when it saves), but sparse files are easier to review.
- JSON has no comments — put coaching context in `notes`.
