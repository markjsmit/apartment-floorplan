# Apartment floorplan

A small 3D walk-through of our new apartment, designed room by room by talking to Claude.

**Live:** https://markjsmit.github.io/apartment-floorplan/

## Controls

| | Desktop | Phone |
|---|---|---|
| Walk | ↑ / ↓ or W / S | ▲ / ▼ buttons |
| Turn | ← / →, two-finger swipe | swipe |
| Step sideways | A / D | ◀ / ▶ |
| Look up / down | E / C, two-finger swipe | swipe |
| Select | click | tap |
| Change state (fold bed, open door) | double-click the moving part | double-tap |

📏 Measure (or M): click two surfaces to get the straight distance between them.

Tabs on top switch rooms (and, on desktop, versions). Mark / Heli switches eye height. 🗺 shows the plan from above.

## Working on it

```
npm install
npm run dev        # http://localhost:5180 — live view + link to Claude
npm run check      # validate house + assets
npx vitest run     # tests
npm run release    # build + publish to GitHub Pages (gh-pages branch)
```

- `house/` — the apartment: `current.json`, `suggestion.json`, `saved/*.json`
- `assets/` — furniture (`asset.json`) and textures (CC0, mostly from [ambientCG](https://ambientcg.com))
- `CLAUDE.md` — how Claude works with this repo

Textures: CC0 from ambientCG. Furniture: self-made from published product dimensions.
