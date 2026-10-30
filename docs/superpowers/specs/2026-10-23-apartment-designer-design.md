# Apartment Designer — Design

Date: 2026-10-23
Owner: Mark (user). Builder: Claude.

## 1. Intent

Mark moves into a new apartment in ~3 weeks. He has fairly accurate measurements but no access yet.
He wants a **talk-to-build** 3D model of the apartment:

- He describes things in the terminal ("I have a storage room, 3x3 m, door on the south wall").
- Claude edits JSON files; a browser 3D view updates live.
- He walks around, gets a **feel** for each room, figures out **what to buy**, and **brainstorms** with Claude.
- Later, he shares a link with his wife Heli to suggest layouts.

The core is built once, in this session's follow-up. After that, **every future session is a design conversation**,
so the repo must teach a fresh Claude session how to work it (see §10).

## 2. Goals

1. House definition as JSON in a folder, room by room, no floorplan required yet (floorplan later must be possible).
2. Everything taggable (rooms, walls, openings, items, parts) so Mark can say "the back wall", "the door closet".
3. Asset library (furniture + textures), taggable, parametric where useful ("2x2 Kallax").
4. Assets with **multiple states** (e.g. a wall bed folded up / down) and **interactive parts** that trigger state changes.
5. First-person 3D walk with keyboard only (Doom style).
6. Room tabs + version tabs.
7. Dev-mode two-way link with Claude: UI state written to disk; Claude can push a few commands to the UI.
8. Static, client-only build for GitHub Pages; shareable URLs.
9. Renders good enough for a real sense of space, light and materials. Free/CC0 assets and self-generated geometry only.
10. A `polish` skill Mark can run occasionally for a deeper asset/texture/realism pass.

## 3. Non-goals (for now)

- Editing in the UI (dragging furniture, renaming, tagging). **All changes go through Claude.**
- Connected floorplan / walking between rooms (schema must allow it later, UI doesn't need it).
- AAA graphics, multiplayer, accounts, a backend in production.
- Click-and-drag mouse-look / pointer lock on desktop.

## 4. Anti-goals (would make it a failure even if it "works")

- **Wrong scale.** If 80 cm doesn't look and feel like 80 cm, the tool is useless. Everything is in real cm.
- **Claude edits the wrong version** (e.g. edits Current while Mark is looking at the AI suggestion).
- **Ambiguity about what "this" is.** Claude must always know what's selected.
- The public build trying to call the local dev server, or breaking without it.
- Slow loop: a JSON edit should show up in the browser within ~1–2 s, without manual reload.

## 5. Decided by Mark

- Tech choice delegated to Claude; Mark suggested TypeScript, Three.js, React.
- Controls (desktop): **arrows = old style (↑/↓ walk, ←/→ turn); W/A/S/D = modern (W/S walk, A/D step sideways); E = look up, C = look down.**
  Also **two-finger trackpad swipe = look around** (horizontal = turn, vertical = look up/down).
- **Selection by click (desktop) or tap (touch).** Selecting any part of a "whole-object" item selects the whole item and gives it a **bright green outline**.
- **Double-click (double-tap) on an item's interactive part cycles its states.**
- **Two tab rows:** row 1 = rooms, row 2 = versions: `Current`, `AI suggestion` (when one exists), saved versions.
- **The open version is the one Claude edits**, whichever it is (including the AI suggestion).
- "**Make this my main**" → the suggestion replaces Current; the suggestion tab disappears.
- Saved versions are kept for comparison; switching versions keeps the camera where it is.
- **Person toggle: Mark (2.00 m) / Heli (1.63 m)** → eye height changes.
- **Info panel on the right** when something is selected.
- **Top-down view** toggle.
- Sizes can be **measured or assumed**; Mark will correct them later and may ask Claude to adjust designs
  (e.g. "window is X, I don't want the light blocked").
- Claude → UI is small: **select/highlight** something ("just in case, I selected the item I mean") and **show a temp proposal**.
  Talking stays in the terminal.
- **Mobile is extremely simple**: room tabs only, no version tabs. Mark uses shared links mainly to show Heli suggestions.
- **Share link**: a URL that opens the current room + version. Heli may open it on phone or laptop.
- A deeper **polish skill** to run once in a while.

## 6. Claude's calls (Mark can override)

- **Stack:** TypeScript, Vite, React, three.js via `@react-three/fiber` + `@react-three/drei`, `@react-three/postprocessing` for the outline. `zod` for schema validation.
- **Units:** centimetres everywhere, Y up. Angles in degrees in JSON.
- **A saved version = a snapshot of the whole house**, not a single room.
- **Collision:** you can't walk through walls or furniture (slide along them). Collision uses each item's current state.
- **Eye height:** Mark ≈ 188 cm, Heli ≈ 151 cm (body height − ~12 cm).
- **Daylight:** sun direction from a **mood** (☀️ day / 🌇 golden hour / 🌙 night (a faint moon through the windows) — fixed sun positions, no date or city; changed 30 Oct 2026, Mark: "it's about the vibes") + each room's compass orientation; light through window openings; soft shadows; an HDRI/environment for ambient light; ACES tone mapping.
- **Light (30 Oct 2026, a tool not a render - Mark):** each room's base light = how easily daylight gets in (own
  windows, the brightest neighbour through open doorways, closed doors block - `src/model/roomLight.ts`) x the mood, as
  a constant light map on that room's materials, eased when doors open. One house-wide light mode on top
  (⚫ off / 🕯️ cozy = decorative lamps / 💡 work = all) adds a level + colour; lamps fade with daylight like eyes
  adapting. Only the 2 nearest lamps are real lights (phone 1), the nearest casts a shadow; LED strips only glow.
- **Info panel** shows: name, tags, asset, real dimensions (W×D×H cm), current state, and which values are assumed.
- **Hover** on desktop: subtle highlight; cursor changes over interactive parts.
- **Public build on desktop** = same viewer minus dev features (no server calls, no Claude commands); state toggles work locally.
  Version tabs on the public desktop build: shown (they're harmless and help Heli compare). Mobile hides them.
- **Furniture state toggling on mobile:** allowed via double-tap (same as desktop), but nothing on screen advertises it.
- **Mobile controls:** swipe to look (yaw + pitch), on-screen buttons for forward/back (and turn), room tabs at the top.
- **A screenshot script** (headless browser) so Claude can *see* a room from a given spot when brainstorming or verifying.

## 7. Data model

### 7.1 Folder layout

```
house/
  current.json            # the main version
  suggestion.json         # optional; the "AI suggestion" tab (absent = no tab)
  saved/<slug>.json       # saved versions ("bed-left-wall.json")
assets/
  furniture/<asset-id>/asset.json   (+ optional model.glb, textures)
  textures/<texture-id>/texture.json (+ image maps)
.ui-state/                # dev only, gitignored
  ui-state.json
  events.log
```

Every version file is a complete house document (same schema). A version's display name and timestamps live in the file (`meta`).

### 7.2 House document

```jsonc
{
  "meta": { "name": "Current", "kind": "current|suggestion|saved", "createdAt": "...", "note": "..." },
  "rooms": [ Room ],
  "layout": null          // future: room positions in house coordinates + connections. Optional, ignored by UI for now.
}
```

### 7.3 Room

```jsonc
{
  "id": "storage",                 // stable id, kebab-case
  "name": "Storage room",
  "tags": ["storage", "extra bedroom"],
  "footprint": [[0,0],[300,0],[300,300],[0,300]],   // polygon, cm, room-local, counter-clockwise; rectangles most common
  "ceilingHeight": 260,
  "northAngle": 0,                 // degrees: direction of north in room-local space; drives compass wall tags + sun
  "floor":   { "material": "oak-planks" },
  "ceiling": { "material": "white-paint" },
  "walls": [                       // one per footprint edge, in edge order; generated on room creation, then editable
    { "id": "storage.wall-s", "edge": 0, "tags": ["south wall", "door wall"], "material": "white-paint", "thickness": 10 }
  ],
  "openings": [                    // doors, windows, passages — cut into a wall
    { "id": "storage.door", "type": "door|window|opening", "wall": "storage.wall-s",
      "offset": 40,                // cm from the wall's start corner to the opening's near edge
      "width": 80, "height": 210, "sill": 0,
      "asset": "door-basic",       // optional visual (frame, leaf); a window gets glass
      "tags": ["the door"] }
  ],
  "items": [ Item ],
  "assumptions": [ { "path": "openings[storage.door].width", "note": "standard door, not measured" } ]
}
```

- **Compass wall tags** ("north wall", …) are auto-derived for axis-aligned walls from `northAngle`, plus any free tags.
- Relative words ("back wall", "left wall") are just tags Mark assigns; Claude adds them when he names them.
- **Measured vs assumed:** any value not listed in `assumptions` is treated as measured. Info panel shows assumed values distinctly.
  Applies at room, opening and item level (items may carry their own `assumptions`).

### 7.4 Item (placed asset)

```jsonc
{
  "id": "storage.kallax-1",
  "asset": "ikea-kallax",
  "params": { "cols": 2, "rows": 2, "color": "white" },   // asset-defined parameters
  "name": "Kallax 2x2",
  "tags": ["the door closet"],
  "position": [20, 0, 150],      // cm, room-local; y = 0 is floor
  "rotation": 90,                // degrees around Y
  "state": "default",            // current state id
  "selectWhole": true,           // default true: click anywhere selects the whole item
  "assumptions": []
}
```

Wall-mounted or against-wall placement: the builder may add a convenience form (`"against": "storage.wall-n", "offset": 50`) that resolves to position/rotation. Builder's call; document it in CLAUDE.md.

### 7.5 Furniture asset

```jsonc
{
  "id": "wall-bed",
  "name": "Wall bed (hinged)",
  "tags": ["bed", "murphy bed", "wall bed", "custom"],
  "source": { "kind": "procedural|parts|gltf", "notes": "...", "license": "CC0 / self-made / ..." },
  "params": { "width": { "default": 140 }, "length": { "default": 200 } },
  "size": [W, H, D],               // or derived from params
  "parts": [
    { "id": "frame", "tags": ["frame"], "geometry": { ... }, "material": "birch-ply" },
    { "id": "bed",   "tags": ["mattress platform"], "geometry": { ... }, "material": "birch-ply",
      "pivot": [0, 40, 0] }        // hinge point, part-local
  ],
  "states": [
    { "id": "up",   "name": "Folded up", "parts": { "bed": { "rotation": [90, 0, 0] } } },
    { "id": "down", "name": "Down",      "parts": { "bed": { "rotation": [0, 0, 0] } } }
  ],
  "defaultState": "up",
  "interactions": [
    { "part": "bed", "action": "cycleStates" }   // double-click on this part cycles; the frame does nothing
  ]
}
```

- **Geometry sources**, in order of preference for the core: (a) parts as primitives declared in JSON (box, cylinder, …),
  (b) a TypeScript **generator** for parametric things (Kallax cols×rows), referenced by id, (c) a `.glb` model with parts mapped to node names (mainly for the polish skill).
- **State transitions animate** (short tween) between part transforms.
- Parts may also change visibility or material per state.

### 7.6 Texture asset

```jsonc
{ "id": "oak-planks", "name": "Oak planks", "tags": ["wood", "floor", "oak"],
  "maps": { "color": "color.jpg", "normal": "normal.jpg", "roughness": "rough.jpg" },
  "tileSize": [120, 20],          // real-world cm one texture tile covers → correct scale
  "fallbackColor": "#b08a5a",
  "source": "ambientCG", "license": "CC0" }
```

Plain colours ("white-paint") are textures with only `fallbackColor` + roughness.

### 7.7 Starter content

- Textures: a handful of CC0 basics (wood floor, white paint, tiles, fabric, birch ply). Source: ambientCG / Poly Haven, small (1K) maps.
- Furniture: IKEA Kallax (parametric), a generic bed, a wall bed with up/down states, a generic wardrobe, a door, a window.
  Real-product dimensions from published specs.
- House: **one example room** so the viewer has something to show. Mark will describe the real rooms in later sessions.

## 8. The app

### 8.1 Views & UI

- **Top bar row 1:** room tabs. **Row 2:** version tabs (hidden on mobile).
- **Right panel:** info for the selection (§6). Hidden when nothing is selected.
- **Small toolbar:** Mark/Heli toggle, top-down toggle, time-of-day slider, **Share link** button.
- **Top-down view:** orthographic view of the current room, same selection behaviour.
- One room rendered at a time (no floorplan yet).

### 8.2 Controls

| Input | Desktop | Touch |
|---|---|---|
| Walk fwd/back | ↑ / ↓ or W / S | on-screen buttons |
| Step sideways | A / D | — |
| Turn | ← / →, or two-finger trackpad swipe left/right | swipe horizontally (+ optional buttons) |
| Look up/down | E / C, or two-finger trackpad swipe up/down | swipe vertically |
| Select | click | tap |
| Cycle states | double-click interactive part | double-tap |
| Deselect | Esc / click empty space | tap empty space |

Trackpad look uses browser `wheel` events (deltaX/deltaY), page scroll/zoom suppressed over the 3D view; a plain mouse wheel just pitches. Pitch is clamped. Movement speed ~ walking pace; holding keys is smooth (not grid steps).

### 8.3 URL state

The URL hash/query holds `room`, `version`, and optionally camera position. Opening a link restores them.
"Share link" copies the URL to the **public GitHub Pages site** (base URL from config) with the current room + version.

## 9. Dev mode: the link between Mark, Claude and the UI

- **One local dev process** (Vite + a small plugin/middleware). No separate server needed unless the builder prefers one.
- **Files → UI:** the dev server watches `house/` and `assets/`; on change the browser reloads the data (not the page) and keeps the camera.
  Invalid JSON/schema → the UI keeps the last good state and shows an error banner with the problem.
- **UI → Claude:** the browser reports UI state to the server (debounced); the server writes `.ui-state/ui-state.json`:
  ```jsonc
  { "updatedAt": "...", "room": "storage", "version": "current",
    "selection": { "item": "storage.kallax-1", "part": "shelf-3", "tags": [...] } | null,
    "camera": { "position": [x,y,z], "yaw": 0, "pitch": 0, "view": "first-person|top-down" },
    "person": "mark", "timeOfDay": 14.5,
    "itemStates": { "storage.wall-bed": "down" } }
  ```
  And appends notable events (select, state change, tab switch) to `.ui-state/events.log` (capped size).
- **Claude → UI:** a tiny CLI (e.g. `npm run ui -- select storage.kallax-1`) that posts to the dev server, which pushes to the browser (SSE or WebSocket).
  Commands: `select <id>`, `clear-selection`, `goto <room> [version]`, `look-at <id>`, `toast "<text>"`.
- **UI-only item state** (bed up/down toggled by double-click) is view state, not a design change: it lives in `ui-state.json`,
  not in the house file — unless Mark asks Claude to make it the default.
- **Temp proposals** = `house/suggestion.json`. Claude writes it and runs `goto <room> suggestion`.
- **Version operations are file operations Claude performs** on request: save Current as a named version, promote suggestion → Current, delete a version.
- **Edit target rule:** before editing, Claude reads `ui-state.json` and edits the version file Mark has open.

## 10. Making future sessions work (critical)

- A project **`CLAUDE.md`** that tells a fresh session, briefly:
  - what this repo is and the talk-to-build loop;
  - **always read `.ui-state/ui-state.json` first**; "this/that/it" = the selection; edit the open version;
  - schema summary, conventions (cm, ids, tags, assumptions), how to add a room / opening / item / asset / texture;
  - how to send UI commands, how to take a screenshot, how to validate (`npm run check`);
  - version operations;
  - when a measurement changes, check for knock-on problems (collisions, blocked windows/doors, walkway < ~70 cm) and tell Mark.
- **`npm run check`**: validates all house versions and assets against the schema, plus sanity checks
  (items inside room bounds, items not overlapping walls/each other, openings fit their wall, asset refs exist, unique ids).
- **Screenshot script** (Playwright or similar) to render a room/version from a camera position to a PNG Claude can look at.
- **Polish skill** in `.claude/skills/polish/SKILL.md`: a deeper pass Mark runs occasionally — research real product dimensions,
  upgrade furniture geometry/materials, swap in better CC0 textures or glTF models (with licenses recorded), tune lighting,
  verify via screenshots, keep everything schema-valid.

## 11. Public build (GitHub Pages)

- `npm run build` produces a static site: viewer + all house versions + assets. No dev server calls, no command channel, no UI-state reporting (compile-time flag).
- GitHub Actions workflow deploys to Pages on push to main. Base path configurable for `<user>.github.io/<repo>/`.
- Desktop: rooms, versions, selection, info panel, state toggles, person toggle, top-down, time of day.
- Mobile (small touch screens): room tabs only + swipe/button movement + tap select + info panel (compact).
- Repo is public: nothing in `house/` or `assets/` should be private; `.ui-state/` is gitignored.

## 12. Quality bar

- Real scale and sensible proportions above all.
- PBR materials with correct texture scale, soft shadows, daylight from windows, decent ambient light. 60 fps on a normal laptop for one room.
- Loads quickly on a phone (small textures, no huge models).

## 13. Left to the builder

- Exact component structure, state management, file names inside `src/`.
- Collision algorithm details, outline implementation, tween library.
- Exact CLI shape for UI commands and screenshots (keep it short to type).
- Primitive geometry vocabulary for parts.
- Test approach (at least: schema validation, geometry derivation from footprint, state resolution, collision).

## 14. Reviewer questions settled by Claude (Mark: please check these)

1. **Publishing & share links.** Claude sets up a local git repo and a GitHub Actions Pages workflow, but **never pushes**; Mark creates the GitHub repo and pushes.
   The public base URL lives in one config value (`public/site.config.json` or similar), empty until Mark gives the repo name; Share link falls back to the current origin.
   **Links to saved versions are stable.** Links to `current` / `suggestion` show whatever is deployed at the time. When sharing a suggestion,
   the UI shows a hint: "ask Claude to save this as a version so the link stays the same". Share also notes that the link only works once pushed.
2. **What can be selected:** items (whole or part), **walls, openings (doors/windows), floor, ceiling**. Selection in `ui-state.json` becomes
   `{ "kind": "item|wall|opening|floor|ceiling", "id": "...", "part": "..." | null, "name": "...", "tags": [...] }`.
   **Deselect:** Esc, the panel's close button, or clicking the selected thing again. (Clicking empty space doesn't exist indoors.)
   Walls/floor get a softer outline than items so the green item outline stays the strong signal.
3. **"Make this my main"** is something Mark **says to Claude** (no UI button; all changes go through Claude).
   `suggestion.json` records `meta.baseRoomHashes` (a content hash per room of the version it was made from).
   On promote (a script Claude runs): rooms whose suggestion hash differs from the base hash are the changed rooms; they are copied into Current.
   Rooms that Current changed meanwhile too are reported as conflicts and the suggestion's room wins only if Mark confirms. No manual revision counters.
4. **Sun:** three moods instead of real solar math (30 Oct 2026): ☀️ day (sun SW, 45° up), 🌇 golden hour (W, 7° up),
   🌙 night (no sun). `meta.location` is no longer used for light.
