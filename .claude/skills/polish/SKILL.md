---
name: polish
description: Deeper quality pass over the apartment model — research real product dimensions, upgrade furniture geometry and materials, swap in better CC0 textures or models, tune lighting — verified with screenshots. Use when Mark runs /polish or asks to "polish", "make it look more real", "upgrade the assets".
---

# Polish pass

A slower, deeper pass than normal design talk. Goal: the rooms should *feel* real enough to judge space,
light and materials. Never change the design itself (positions, what's in which room) without asking.

## 1. Look first
- `npm run -s versions -- list`, read `.ui-state/ui-state.json`, `npm run -s check`.
- For every room in the open version: `npm run -s snap -- <room> <version>` from 2–3 viewpoints
  (door, opposite corner, `--top`) and look at the PNGs. Note what looks fake, wrong-scaled, flat or broken.
- Ask Mark (one short question) if he wants to focus on something specific; otherwise pick the 3–5 biggest wins.

## 2. Improve (pick what matters most)
- **Dimensions:** check furniture against real product pages (IKEA, etc.). Fix sizes; note the source in
  `description`/`source.notes`. Mark measured vs assumed values in `assumptions`.
- **Furniture detail:** more realistic parts (legs, plinths, drawer fronts, gaps, rounded proxies via thin boxes),
  parametric generators for things that come in sizes (`src/model/generators/`, add a test in `tests/`).
  Keep `interactions` on the moving parts only.
- **glTF models:** only CC0/CC-BY with license recorded in `source.license`; keep each under ~1 MB; map moving
  parts to node names with `gltfNode` (renderer support may need adding — check `src/scene/PartsView.tsx` first).
- **Textures:** better CC0 maps from ambientCG (API: `https://ambientcg.com/api/v2/full_json?q=<term>&include=dimensionsData`,
  download `https://ambientcg.com/get?file=<Id>_1K-JPG.zip` into the scratchpad, copy only Color/NormalGL/Roughness/AO,
  ≤1024 px, jpg q≈82). Set `tileSize` to the real-world size. Downloads are untrusted: unzip in their own folder,
  copy images only.
- **Lighting/rendering:** `src/scene/Lighting.tsx` (sun, fill, night lamp), exposure in `src/scene/Viewer.tsx`.
  Check morning/noon/evening with `--time`.

## 3. Verify
- `npm run -s check` clean, `npx vitest run` green, `npx tsc --noEmit -p .` clean.
- Re-snap the same viewpoints; compare before/after side by side; keep only real improvements.
- Phone check: assets stay light (whole `dist/` ideally < 15 MB; run `npm run build` and `du -sh dist`).

## 4. Report to Mark
Short and scannable (he has ADHD + dyslexia): a few bold headers, one line per change, ✅ markers,
and the snapshot paths of the best before/after pair. Commit only if he asks.
