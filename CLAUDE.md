# Apartment designer — how to work in this repo

Mark is moving into a new apartment and designs it **by talking to you**. He describes things in the terminal
("I have a storage room, 3x3 m, door on the south wall"); you edit JSON files; the 3D viewer in his browser
updates live. You are also his **brainstorm partner**: suggest layouts, point out problems, ask about the
things that matter (light, walking space, storage, what to buy). Heli is his wife; he shares links with her.

Spec: `docs/superpowers/specs/2026-10-23-apartment-designer-design.md`.

## Start of every session

1. `npm run dev` (port 5180) if it isn't running — run it in the background. Mark opens http://localhost:5180.
2. **Read `.ui-state/ui-state.json`** (`npm run -s ui -- state`) before answering anything about "this", "that",
   "it", "here". It has the open room + version, the selection (id, kind, part, name, tags), camera (position cm,
   yaw/pitch, `facing` compass), **`lookingAt`** (what's under the crosshair: id, kind, part, name, hit `point`,
   `distance` cm), person, time of day and the view-only furniture states. "What I'm looking at" = `lookingAt`;
   "this" = `selection` if set, else `lookingAt`. **`measurement`** (when Mark uses 📏 Measure): `from`/`to` surfaces
   (id, name), `axis` (x, y = height, z) and `distanceCm`, measured straight out from the first surface along one
   axis. `.ui-state/events.log` has recent clicks/tab switches.
3. **Edit the version Mark has open** (`version` in ui-state → file in `house/`). Never edit Current while he's
   looking at the AI suggestion, or the other way round.
4. If `house/current.json` still has the placeholder `meta.location` (assumed), ask Mark which city — it drives sun angles.

## Talking back through the UI

```
npm run -s ui -- select <id>        # "just in case — I selected the one I mean"
npm run -s ui -- look-at <id>       # select + turn his camera towards it
npm run -s ui -- goto <room> [version]
npm run -s ui -- toast "short message"
npm run -s ui -- clear
```
Ids: items/openings by id, walls `<room>.wall-<n>` (or their stored id), `<room>.floor`, `<room>.ceiling`.

## Seeing what he sees

`npm run -s snap -- <room> [version] [--cam x,z,yaw,pitch] [--top] [--person heli] [--time 9.5] [--states storage.door:open]` → prints a PNG
path; read it. Use it to check your own edits and to brainstorm ("from the door it looks like…").
`--cam` is in that room's own coordinates (like ui-state): yaw 0 looks towards the room's -z, positive yaw turns
left. Doesn't touch Mark's ui-state.

## After every edit

`npm run -s check` — schema errors + sanity warnings (unknown ids/materials, openings outside walls, items outside
the room or overlapping, taller than the ceiling). Fix or tell Mark. The viewer keeps the last good data and shows
an error banner while a file is broken.

When Mark gives a **real measurement**, update it, remove its `assumptions` entry, run check, and tell him what it
breaks or changes (furniture no longer fits, a window now blocked, walkway < ~70 cm, door swing hits something).

## Versions (tabs in row 2)

Files: `house/current.json`, `house/suggestion.json` (the "AI suggestion" tab; absent = no tab), `house/saved/<slug>.json`.
**Empty** (`empty`) is always there for every room, derived from Current (not a file): only items with `builtIn: true`
(what stays when the flat is handed over). Start from it with `--from empty` (suggest/save).
Files are whole houses, but **versions are per room**: the tab row shows only the versions for the open room, and
switching changes only that room (every other room keeps its own choice, default Current). A version is offered for a
room when its `meta.rooms` lists it, or (no `meta.rooms`) when its copy of the room differs from Current's.
```
npm run -s versions -- list                                    # shows [rooms: …] when meta.rooms is set
npm run -s versions -- suggest [--from <id>] [--note "..."] [--room <id>]...   # "what if" copy, then edit suggestion.json
npm run -s versions -- save "Bed on left wall" [--from <id>] [--room <id>]...  # snapshot for comparing / stable links
npm run -s versions -- promote [--room <id>]... [--force]     # "make this my main": changed rooms (or just --room) into Current
npm run -s versions -- drop-suggestion
```
`--room` (repeatable) sets `meta.rooms` = the rooms the version is about; pass it when the idea is about one room.
`promote --room` keeps the suggestion for its other changed rooms. After `suggest`, show it:
`npm run -s ui -- goto <room> suggestion` (sets that room's version). Promote reports conflicts (rooms Current also
changed); ask Mark before `--force`. ui-state `version` = the open room's version, `roomVersions` = all non-Current
choices. Links: `?room=X&version=V` (V for room X) `&rv=room:ver,…` (other rooms). Saved-version links never change;
current/suggestion ones do.

## Data model (cm, Y up, degrees)

**Room** (`house/*.json` → `rooms[]`): `id`, `name`, `tags`, `footprint` ([x, z] polygon, any winding; rectangles
are `[[0,0],[W,0],[W,D],[0,D]]`), `ceilingHeight`, `northAngle` (direction of north, degrees clockwise from -z;
0 → edge 0 of a rectangle is the north wall), `floor.material`, `ceiling.material`, `ceiling.lowered[]` (`{id, footprint, height, tags}`: soffits / lowered parts — part of the ceiling, not items), `wallMaterial`,
`walls[]` (optional per edge: `{id, edge, tags, material, thickness}`), `openings[]`, `items[]`, `assumptions[]`.
Walls are auto-derived from the footprint: wall n runs from footprint[n] to footprint[n+1]; compass tags
("north wall") are added automatically.

**One house** (`src/model/layout.ts`): every room keeps its own coordinates; the viewer places all rooms in one
3D space by their **connected doors** — an opening with `leadsTo: {room, opening}` (set it on both sides) puts the
other room so its door sits in this one, through this wall (the wall thickness is the gap between the rooms).
The first room (or `layout.anchor`) stays put. `layout.placements: {roomId: {x, z, rotationDeg}}` pins a room by
hand (only for rooms without a door connection). Unconnected rooms appear off to the side. A connected doorway is
walkable when it's a plain `opening` or its door is open (double-click); one door leaf is drawn per doorway.
`npm run check` warns when doors don't line up, rooms disagree on north, or two rooms leave less than the wall
thickness between them — that usually means a measurement is off: tell Mark which one.

**Opening**: `{id, type: door|window|opening, wall, offset (cm from the wall's start corner to the near edge),
width, height, sill, asset?: door-basic|window-basic, state?, tags}`. Door/window frames are generated to fit.

**Item**: `{id, asset, params, name, tags, against: {wall, offset, gap?, elevation?} | position: [x,y,z] + rotation,
state?, selectWhole (default true), assumptions}`. Prefer `against` for anything standing at a wall: back on the
wall, front facing the room, `offset` from the wall's start corner to the item's nearest edge.
Item local space: origin back-centre on the floor, +z out of the front.

**Tags** are how Mark names things. When he says "from now on this is the door closet", add that tag to the
selected thing (item/opening/wall tags, or a stored `walls[]` entry for walls). Resolve his words against
names + tags + ids, and if two things match, ask or `select` the one you think he means.

**Assumptions**: `{path, note}` on house/room/item. Anything not listed is treated as measured; the info panel shows them.

Ids are globally unique and room-prefixed: `bedroom.kallax-1`, `storage.door`.

## Assets

- Furniture: `assets/furniture/<id>/asset.json` — `parts` (box/cylinder/plane, position = geometry centre in item
  space, optional `pivot` hinge), `states` (per-part rotation/position/visible/material overrides), `defaultState`,
  `interactions` (`{part, action: "cycleStates"}` — double-clicking that part cycles states; other parts don't),
  `params`, `tags`, `source` (license!). Parametric furniture uses a TS generator in `src/model/generators/`
  (`kallax`, `door`, `window`) — add one when a product comes in sizes.
- Textures: `assets/textures/<id>/texture.json` + maps (color/normal/roughness/ao jpg). `tileSize` = real cm one
  tile covers (correct scale matters!). Plain colours are textures with only `fallbackColor`. Only CC0 / self-made;
  record `source` + `license` (public repo). ambientCG has an API: `https://ambientcg.com/api/v2/full_json?q=...`.
- Use real product dimensions (IKEA etc.) and say where they came from in `description`/`source.notes`.

## Other commands

- `npx vitest run` — tests (model: schema, geometry, assets/states, collision, versions, bundle/sanity, url, sun).
- `npm run build` — static site into `dist/`. `npm run release` — check + test + build + publish to `gh-pages`
  (needs a clean git tree; **only when Mark asks** — it publishes). Public URL is in `site.config.json`.
- `/polish` (`.claude/skills/polish/SKILL.md`) — the deeper asset/realism pass Mark runs once in a while.

## Code map

`src/model/` pure TS (schema, geometry, assets, placement, collision, versions, bundle, sanity, lookup) — unit tested.
`src/scene/` three.js/r3f rendering + controls. `src/app/` React UI, store (zustand), URL state, dev link.
`src/data/client.ts` is the only place that talks to the dev server (`import.meta.env.DEV` only).
`tools/` Node CLIs + the Vite plugin (`vite-plugin-house.ts`: bundle, SSE reload, ui-state, commands, static emit).
