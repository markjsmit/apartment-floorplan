# Apartment Designer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A talk-to-build 3D apartment viewer: JSON house + asset library on disk, a three.js first-person viewer with rooms/versions tabs, a dev link to Claude (UI state file + command channel), and a static GitHub Pages build.

**Architecture:** Vite + React + react-three-fiber app. Pure TS model layer (`src/model`, zod schemas, geometry, states, collision) is unit tested. A Vite plugin (`tools/vite-plugin-house.ts`) serves a validated data bundle in dev (with SSE live reload, UI-state writing, command relay) and emits the same bundle as static files at build time. Node scripts in `tools/` give Claude CLIs: `check`, `ui`, `version`, `snap`, `release`.

**Tech Stack:** TypeScript, Vite 5, React 18, three, @react-three/fiber 8, @react-three/drei 9, @react-three/postprocessing (N8AO), zustand, zod, suncalc, vitest, tsx, playwright (screenshots), gh-pages (release).

**Spec:** `docs/superpowers/specs/2026-10-23-apartment-designer-design.md`

## Global Constraints

- Units: **cm**, Y up, angles in **degrees** in JSON. Room-local coords: footprint points `[x, z]`.
- Ids are globally unique and room-prefixed: `<room>.<thing>` (walls `<room>.wall-<edgeIndex>`, floor `<room>.floor`, ceiling `<room>.ceiling`).
- Keys: ↑/↓ walk, ←/→ and A/D turn, E look up, C look down; two-finger trackpad (`wheel` deltaX/deltaY) look.
- Eye heights: Mark 188 cm, Heli 151 cm.
- Selection outline for items: bright green `#39ff14`.
- Dev server port **5180** (strictPort). Public URL: `https://markjsmit.github.io/apartment-floorplan/` (Vite `base` `/apartment-floorplan/` in production).
- Static build makes **no** `/api` calls (compile-time `import.meta.env.DEV` guard).
- `.ui-state/` gitignored. Nothing private in `house/` or `assets/` (public repo).
- Claude never pushes; `npm run release` is for Mark (or Claude when Mark asks).

## Review Focus

1. **Invalid JSON mid-edit** (Claude saves a half-edited file) → UI keeps last good data for that file and shows an error banner; does not go blank. → Task 6 test `mergeBundle keeps previous file on error`.
2. **URL pointing at a missing room/version** (old share link) → falls back to first room / `current`, no crash. → Task 9 test `parseUrlState falls back`.
3. **Snapshot/screenshot runs clobbering Mark's selection** → `?noreport=1` disables UI-state reporting. → Task 9 test `shouldReport false with noreport`.
4. **Opening wider than its wall or outside it / item outside room** → `npm run check` reports it with ids. → Task 6 test `sanity flags opening outside wall`.
5. **Player spawning inside furniture or switching to a smaller room** → spawn/clamp to a free point inside the footprint. → Task 4 test `findFreeSpawn avoids colliders`.

---

### Task 1: Scaffold + schemas

**Files:** Create `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `site.config.json`, `src/main.tsx` (placeholder), `src/model/schema.ts`, `tests/schema.test.ts`.

**Interfaces — Produces** (`src/model/schema.ts`, zod + inferred types):
- `Vec3 = [number,number,number]`, `Assumption {path: string; note?: string}`
- `Wall {id; edge: number; tags: string[]; material?: string; thickness: number=10}`
- `Opening {id; type: 'door'|'window'|'opening'; wall: string; offset; width; height; sill=0; asset?; tags: string[]; name?}`
- `Item {id; asset; params: Record<string, unknown>={}; name?; tags=[]; position?: Vec3; rotation=0; against?: {wall: string; offset: number; gap=0}; state?; selectWhole=true; assumptions=[]}` (refine: `position` xor `against`)
- `Room {id; name; tags=[]; footprint: [number,number][] (≥3); ceilingHeight; northAngle=0; floor:{material}; ceiling:{material}; walls: Wall[]=[]; openings=[]; items=[]; assumptions=[]}`
- `HouseMeta {name; kind: 'current'|'suggestion'|'saved'; createdAt?; note?; location?: {lat; lon; label?}; baseRoomHashes?: Record<string,string>}`
- `House {meta; rooms: Room[]; layout: unknown|null = null; assumptions=[]}`
- `Geometry = {type:'box'; size: Vec3} | {type:'cylinder'; radius; height; segments=24} | {type:'plane'; size:[w,h]}`
- `Part {id; tags=[]; geometry?: Geometry; gltfNode?: string; position: Vec3=[0,0,0]; rotation: Vec3=[0,0,0]; pivot?: Vec3; material?: string; color?: string; castShadow=true; glass=false}`
- `PartOverride {position?; rotation?; visible?; material?}`; `AssetState {id; name; parts: Record<string, PartOverride>={}}`
- `FurnitureAsset {id; name; tags; source:{kind:'parts'|'procedural'|'gltf'; generator?; file?; notes?; license?}; params: Record<string,{default: unknown; description?}>={}; parts: Part[]=[]; states: AssetState[]=[{id:'default',name:'Default'}]; defaultState?; interactions: {part: string; action:'cycleStates'}[]=[]}`
- `TextureAsset {id; name; tags; maps:{color?; normal?; roughness?; ao?}={}; tileSize:[number,number]=[100,100]; fallbackColor; roughness=0.8; metalness=0; source?; license?}`

- [ ] Step 1: `npm init`, install deps (see Tech Stack + `@types/*`, `@vitejs/plugin-react`, `vitest`, `tsx`). Scripts: `dev`, `build`, `preview`, `test`, `check`, `ui`, `version`, `snap`, `release`. `.gitignore`: `node_modules dist .ui-state .snaps .DS_Store .idea`.
- [ ] Step 2: Failing test `tests/schema.test.ts`: parses a minimal room with defaults (`walls` = `[]`, `rotation` 0); rejects item with both `position` and `against`; rejects footprint of 2 points.
- [ ] Step 3: Implement schemas. Step 4: `npx vitest run` PASS. Step 5: commit.

### Task 2: Room geometry

**Files:** `src/model/geometry.ts`, `tests/geometry.test.ts`.

**Interfaces — Produces:**
- `type WallInfo = {id; edge; start:[x,z]; end:[x,z]; dir:[x,z] (unit); length; inward:[x,z] (unit normal into room); thickness; tags: string[] (stored + compass); material?}`
- `resolveWalls(room: Room): WallInfo[]` — one per edge; stored walls override defaults by `edge`; compass tag added from outward normal + `northAngle` (only within ±10° of a cardinal): `"north wall"` etc.
- `compassOf(outward:[x,z], northAngle): 'north'|'east'|'south'|'west'|null` — northAngle = degrees clockwise from room-local −z.
- `wallSegments(wall: WallInfo, openings: Opening[], ceilingHeight): {u0;u1;y0;y1}[]` — rectangles (along-wall u, height y) covering the wall minus openings.
- `resolveItemTransform(item: Item, size:{w;d}, walls: WallInfo[]): {position: Vec3; rotationDeg: number}` — `against`: item local +z = wall inward normal, center = start + dir·(offset + w/2) + inward·(gap + 0)` (item origin = back-center on floor, so back touches wall).
- `roomBounds(room): {minX;maxX;minZ;maxZ}`, `pointInPolygon(p, poly)`.

- [ ] Step 1: Tests: 300×300 square → 4 walls, lengths 300, inward normals point to center; northAngle 0 → wall with outward −z tagged `"north wall"`, northAngle 90 → that wall tagged `"west wall"`; door offset 40 width 80 height 210 on 300-long, 260-high wall → segments cover `[0,40]`, `[120,300]`, `[40,120]×[210,260]`; window with sill 90 also yields a below-segment; against wall-0 offset 50, w=80 → center 90 cm along wall, rotation makes local +z equal inward.
- [ ] Step 2: fail → implement → pass → commit.

### Task 3: Assets, generators, states

**Files:** `src/model/assets.ts`, `src/model/generators/index.ts`, `src/model/generators/kallax.ts`, `tests/assets.test.ts`.

**Interfaces — Produces:**
- `generators: Record<string, (params: Record<string,unknown>) => Part[]>`; `kallax({cols=2, rows=2, color})` — real Kallax: cell 33.5 cm inner, board 1.5 cm (outer frame 3.9 cm... use outer 1x1 = 42×42, 2x2 = 77×77, 4x4 = 147×147 W×H, depth 39); part ids `frame-*`, `shelf-r-c`.
- `resolveParams(asset, item): Record<string,unknown>` (defaults + item.params)
- `resolveParts(asset, item): Part[]` — generator or declared parts.
- `assetSize(parts: Part[], stateId?): {w;h;d; min:Vec3; max:Vec3}` — AABB of box/cylinder parts after state transforms.
- `partTransform(part, override?): {position: Vec3; rotationDeg: Vec3; visible: boolean; material?}` — rotation applied about `pivot`.
- `nextState(asset, current): string` (cycles, wraps), `initialState(asset, item, uiOverride?)`.
- `interactivePart(asset, partId): boolean`.

- [ ] Tests: kallax 2x2 size ≈ 77×77×39 (±0.5); wall-bed fixture with `bed` rotated 90° about pivot changes AABB depth; `nextState` cycles `up→down→up`; unknown state falls back to default. Fail → implement → pass → commit.

### Task 4: Collision + spawn

**Files:** `src/model/collision.ts`, `tests/collision.test.ts`.

**Interfaces — Produces:**
- `type Collider = {kind:'segment'; a:[x,z]; b:[x,z]} | {kind:'obb'; center:[x,z]; half:[hx,hz]; angleDeg}`
- `buildColliders(walls: WallInfo[], items: {position; rotationDeg; min; max}[]): Collider[]` — all walls solid (rooms are isolated; doors don't lead anywhere yet); item OBB from its state-AABB, skipped if `min.y > 150` (wall shelves above head-ish).
- `moveWithCollision(pos:[x,z], delta:[x,z], radius: number, colliders): [x,z]` — slide along obstacles (resolve x then z, push-out).
- `findFreeSpawn(room, colliders, radius): [x,z]` — room centroid if free, else grid search.

- [ ] Tests: walking into a wall stops at radius 20 and slides along it; can't enter a 100×100 OBB; `findFreeSpawn avoids colliders` when the centroid is occupied. Commit.

### Task 5: Versions tool

**Files:** `src/model/versions.ts`, `tools/version.ts`, `tests/versions.test.ts`.

**Interfaces — Produces:**
- `roomHash(room): string` (sha1 of stable-stringified room).
- `versionIdFromPath(rel): string` — `house/current.json`→`current`, `house/suggestion.json`→`suggestion`, `house/saved/x.json`→`saved/x`; `versionPath(id)` inverse.
- `makeSuggestion(base: House, note?): House` — copy with `meta.kind='suggestion'`, `baseRoomHashes`.
- `promote(current: House, suggestion: House): {house: House; changed: string[]; conflicts: string[]}` — changed = rooms differing from base (incl. new rooms; rooms removed in suggestion are removed); conflict = also changed in Current since base; conflicts are NOT applied unless `force`.
- CLI `npm run version -- list | suggest [--from <id>] [--note ..] | promote [--force] | save <name> [--from <id>] | drop-suggestion` — `save` slugifies name, sets `meta.kind='saved'`, `meta.name=name`.

- [ ] Tests: promote with untouched Current applies all changed rooms; Current edited in other room → still merges, no conflict; same room edited both sides → conflict reported, Current room kept. Commit.

### Task 6: Bundle loading + check

**Files:** `src/model/bundle.ts`, `tools/load-files.ts`, `tools/check.ts`, `tests/bundle.test.ts`.

**Interfaces — Produces:**
- `type Bundle = {versions: Record<string, House>; furniture: Record<string, FurnitureAsset>; textures: Record<string, TextureAsset & {baseUrl: string}>; site: {publicUrl: string}; errors: FileError[]}`; `FileError {file; message}`.
- `loadBundleFromDisk(root): Bundle` (node; reads `house/**.json`, `assets/furniture/*/asset.json`, `assets/textures/*/texture.json`, `site.config.json`; invalid files go to `errors` with zod path messages; texture `baseUrl` = `lib/textures/<id>/`).
- `mergeBundle(prev: Bundle|null, next: Bundle): Bundle` — for each errored file keep `prev`'s entry.
- `sanityCheck(bundle): string[]` — unknown asset/material/wall refs, duplicate ids, opening outside wall (`offset+width>length`, `sill+height>ceiling`), item AABB outside footprint, items overlapping (OBB overlap > 2 cm), missing interaction parts.
- `npm run check` prints errors + sanity, exit 1 on any.
- [ ] Tests: `mergeBundle keeps previous file on error`; `sanity flags opening outside wall`; duplicate id flagged. Commit.

### Task 7: Dev/build plugin + `ui` CLI

**Files:** `tools/vite-plugin-house.ts`, `tools/ui.ts`, `src/data/client.ts`, modify `vite.config.ts`.

**Interfaces — Produces:**
- Dev endpoints: `GET /api/bundle` → Bundle; `GET /api/events` (SSE: `{type:'reload'}` on `house/`/`assets/`/`site.config.json` change, debounced 150 ms; `{type:'command', command}`); `POST /api/ui-state` → writes `.ui-state/ui-state.json` (adds `updatedAt`); `POST /api/event` → appends JSON line to `.ui-state/events.log` (truncate to last 500 lines); `POST /api/command` → broadcast. Static file serving `/lib/*` from `assets/*`.
- Build: emit `bundle.json` (errors must be empty or build fails) and copy `assets/**` (except json) to `lib/`.
- `src/data/client.ts`: `fetchBundle(): Promise<Bundle>` (`/api/bundle` in DEV, `${BASE_URL}bundle.json` otherwise); `subscribe(onReload, onCommand)` (DEV only, else no-op); `reportUiState(state)` (DEV, debounced 300 ms); `reportEvent(e)`.
- `Command = {type:'select'; id} | {type:'clear'} | {type:'goto'; room; version?} | {type:'look-at'; id} | {type:'toast'; text} | {type:'reload'}`.
- CLI: `npm run ui -- select <id> | clear | goto <room> [version] | look-at <id> | toast "<text>" | state` (`state` prints ui-state.json).
- [ ] Verify: `npm run dev` then `curl localhost:5180/api/bundle | head -c 200`; `npm run ui -- toast hi` returns ok. Commit.

### Task 8: Starter content

**Files:** `assets/textures/{oak-planks,white-paint,birch-ply,fabric-grey,tiles-white,wood-dark}/texture.json` (+ 1K CC0 maps from ambientCG if downloadable, else procedural-only with `fallbackColor`); `assets/furniture/{ikea-kallax,bed-double,wall-bed,wardrobe,door-basic,window-basic}/asset.json`; `house/current.json` (one example room "Bedroom", 350×300, ceiling 260, door + window, a Kallax and the wall bed; location placeholder with assumption).
- door-basic: frame + leaf (`leaf` interactive, states `closed`/`open` 90° about hinge). window-basic: frame + glass (`glass: true`). wall-bed: cabinet frame + `bed` platform (interactive) with `up`/`down` states about a bottom pivot.
- [ ] Verify: `npm run check` exit 0. Commit.

### Task 9: App shell, store, URL state

**Files:** `src/app/store.ts`, `src/app/url.ts`, `src/app/App.tsx`, `src/app/Tabs.tsx`, `src/app/InfoPanel.tsx`, `src/app/Toolbar.tsx`, `src/app/Banner.tsx` (errors + toasts), `src/app/useIsMobile.ts`, `src/app/app.css`, `tests/url.test.ts`.

**Interfaces — Produces:**
- zustand `useStore` with: `bundle`, `roomId`, `versionId`, `selection: {kind:'item'|'wall'|'opening'|'floor'|'ceiling'; id; part: string|null} | null`, `itemStates: Record<string,string>`, `person:'mark'|'heli'`, `view:'first-person'|'top-down'`, `timeOfDay` (hours, default 14), `dayOfYear` (default today), `camera: {x;z;yaw;pitch}`, `toasts`, actions `setRoom`, `setVersion`, `select`, `cycleItemState(itemId)`, `lookAt(id)`.
- `parseUrlState(search, bundle): {roomId; versionId; camera?; view?; person?; noreport: boolean}` — falls back to first room / `current`. `serializeUrlState(state): string`. `shouldReport(urlState): boolean`.
- `shareUrl(state, publicUrl)`; when versionId is `current`/`suggestion` show hint text from spec §14.1.
- Mobile (`(pointer: coarse)` and width < 900): only room tabs + compact info panel + touch controls.
- [ ] Tests: `parseUrlState falls back` for unknown room/version; round-trip serialize/parse; `shouldReport false with noreport`. Commit.

### Task 10: Scene rendering

**Files:** `src/scene/Viewer.tsx`, `src/scene/RoomView.tsx`, `src/scene/ItemView.tsx`, `src/scene/OpeningView.tsx`, `src/scene/materials.ts`, `src/scene/Lighting.tsx`, `src/scene/sun.ts`, `tests/sun.test.ts`.

- materials: `useMaterial(textureId)` → cached `MeshStandardMaterial`; textures RepeatWrapping with `repeat = 1/tileSize` because all generated geometry uses **cm UVs** (helper `boxWithCmUV(w,h,d)` / `planeWithCmUV(w,h)`).
- Walls: boxes per `wallSegments`, extruding outward by thickness. Floor/ceiling: `ShapeGeometry` from footprint. Ceiling hidden in top-down.
- Items: group at resolved transform; each part a mesh; per-frame damp toward state transform (≈250 ms). Selected → drei `<Outlines color="#39ff14" thickness={3} screenspace>` on all item meshes (only the part if `selectWhole` false); wall/floor selection → softer outline (`#9fffb0`, thinner).
- Click → `select`, double-click on interactive part → `cycleItemState`; `stopPropagation` so nearest hit wins.
- Lighting: `sunDirection(lat, lon, date, hours, northAngle): Vector3 | null` (suncalc; azimuth from south → room space); directional sun with shadows sized to room bounds; low ambient + hemisphere; local `<Environment>` with `<Lightformer>`s (no network); drei `<Sky>` outside; ACES, PCFSoft shadows; N8AO on desktop only.
- [ ] Test `sun.test.ts`: at lat 50 on Jun 21 12:00 local solar noon sun is south and elevation ≈ 63°; at midnight returns null. Visual check via Task 12 screenshots. Commit.

### Task 11: Controls

**Files:** `src/scene/PlayerControls.tsx`, `src/scene/TopDownCamera.tsx`, `src/app/TouchControls.tsx`.

- Keyboard: speed 140 cm/s, turn 100°/s, pitch 70°/s clamped ±80°; ignore keys when focus is in an input. `wheel` on canvas: `preventDefault`, yaw −= deltaX·0.15°, pitch −= deltaY·0.15°; `ctrlKey` (pinch) ignored.
- Uses `moveWithCollision`, radius 20; spawn via `findFreeSpawn` on room change, keep position on version change (clamp if now blocked).
- Top-down: orthographic camera framing room bounds +10%, −z up; player marker (cone) shows position/yaw; arrows still move the player.
- Touch: one-finger drag on canvas = yaw/pitch (0.25°/px); on-screen buttons ▲▼◀▶ (hold to move).
- Camera position written to store (throttled 4 Hz) for ui-state reporting.
- [ ] Verify manually via screenshots + keyboard in browser (Task 12). Commit.

### Task 12: Claude link wiring + snap

**Files:** `src/app/useDevLink.ts`, `tools/snap.ts`.
- `useDevLink`: subscribes; on reload → `fetchBundle` + `mergeBundle`; on command → store actions (`goto` sets room/version, `look-at` turns camera toward item center, `toast` shows 6 s). Reports ui-state (spec §9 shape + `selection.name/tags`) and events (select, state change, tab switch) unless `noreport`.
- `npm run snap -- <room> [version] [--cam x,z,yaw,pitch] [--top] [--person heli] [--time 9.5]` → starts Vite on 5181 if 5180 not reachable, opens `?…&noreport=1`, waits for `window.__sceneReady`, writes `.snaps/<room>-<version>.png`, prints path.
- [ ] Verify: snap the example room (first-person + top-down), look at the PNGs, fix visual problems. Commit.

### Task 13: Docs, polish skill, release

**Files:** `CLAUDE.md`, `README.md`, `.claude/skills/polish/SKILL.md`, `tools/release.ts`.
- `CLAUDE.md`: session start ritual (read `.ui-state/ui-state.json`, edit the open version), schema cheat sheet, conventions, recipes (add room / opening / item / asset / texture / save version / suggestion / promote), CLI list, knock-on checks after measurement changes, ask for city if `location` still assumed.
- `release.ts` (`npm run release`): require clean git tree, run `check` + `test` + `build`, publish `dist/` to `gh-pages` branch via `gh-pages` package, print public URL and the one-time Pages setting (Source: `gh-pages` branch).
- [ ] Verify: `npm run build && npx vite preview` loads bundle from `/apartment-floorplan/bundle.json` with no `/api` requests. Commit.
