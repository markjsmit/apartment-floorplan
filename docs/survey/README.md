# Survey of 27 Oct 2026: camera map and findings

How the apartment model (`house/current.json`) was checked against Mark's survey. The survey files themselves are in
`sources/new house full/`, which is not in git: `notes/` holds the laser measurements, `around the house/` has 164
photos, and `video/20261027_160951.mp4` is a 106 s walk-through.

## Coordinates

Everything uses the model's global plan in cm: **X east, Z south** (north = −Z = the balcony side). **Yaw** follows
the viewer's convention: 0 = looking north, 90 = west, −90 = east, 180 = south. This is the same as
`npm run -s snap -- <room> --cam x,z,yaw,pitch`, so any row below can be re-rendered to compare with the photo or frame.

## Files

- `video-poses.csv`: camera position and heading for every 4 fps video frame (`t` in seconds), plus what's visible.
  Keyframes were placed by hand and the frames between them interpolated (`(interp)`). Accuracy is about ±20 cm and ±15°.
- `photo-poses.csv`: the photos matched to those viewpoints. Each row gives the photo's estimated camera pose, the
  nearest video time and what the photo shows. The photos (16:06:51–16:09:32) were taken on the same route just
  before the video (16:09:51).

Use the video to work out where you are, then the matching photo for detail.

**Caveat:** the poses were estimated against the model *before* the sweep fixes (commit `2debbe0`). In that version
the hallway ran on to x = 908, and the bedroom entry started there. Rows east of x ≈ 812 in the hallway or bedroom
entry are therefore up to ~1 m off in x. Everything west of the hallway end is unaffected.

## Method

1. Six parallel passes. Four went through the photos, about 40 each. Two went through the video at 4 fps, tracking
   the camera pose on every frame.
2. Every finding was cross-checked from a second viewpoint. Preferably that was the way back or the other side of the
   same wall, e.g. the hallway seen from the kitchen (video 23–28 s) and from the bedroom door (photos 160921–24).
3. Findings that agreed across passes were applied. Where passes disagreed, the photos were re-read, and the
   remaining questions are listed below.

## Cycle 2 (photo-vs-render, poses solved per photo)

- **Hallway south side** is on z 486: the hallway is as wide as its 209 opening to the living room. The glossy
  **123 × 38 block** is the corner column north of the fridge (x 508–631, z 486–524), west face flush with the tall
  units. **"1.68 m"** on the notes = from the pillar (z 356) to the start of the fridge run (z 524).
- **Bathroom** 224 × 188 at x 578–802, z 496–684. Door at x 650–730: bath along the west wall just west of it,
  toilet straight ahead, vanity + washer column on the east wall.
- **Front door** is 140 from the dining corner (the notes label is upside down). Kitchen tall units from the block:
  fridge 100, oven 60, narrow 36. The entrance bulkhead (~215) runs over the whole counter.
- **En-suite**: frosted glass panel + door from the bedroom entry, toilet on the west wall under a tiled ledge, shower
  at the end. The vanity + mirror stand in the entry.
- **Lights** placed from a light survey (soffit downlights, two track rails, mirror lights, en-suite panel).

## What the sweep changed (commit `2debbe0` and after)

- **Hallway:** it ends at x ≈ 812, so the bedroom door is right next to the bathroom door. On the north side there is
  a ~12 cm fin (the "little wall") and a ~115 × 42 dresser niche.
- **"hallway cabin 123 × 38"** (notes) is the glossy, handleless block on the hallway's south wall next to the fridge.
- **"bedroom side cabin 80 × ?"** (notes) is the shoe-rack recess just inside the bedroom door.
- **Living room:**
  - The 238 lowered ceiling covers the whole east side, with the AC grille on its west face.
  - There is a bulkhead (~215) over the front door and counter.
  - The sofa window is ~120 × 125.
  - Window tops are 55 below the ceiling ("גובה מעל חלון 55").
- **Balcony:** ~10 m² (Mark), 410 × 245. It ends at the stone side wall just before the sofa window and has a glass
  railing on the north and west.
- **Bathroom:** a tiled ledge (~115) runs along the toilet and bath wall, and there is a dark wall cabinet over the toilet.

## Still open

- **En-suite inner layout:** frosted glass door or partition, which wall the toilet is on, and whether the vanity is
  in the en-suite or the bedroom entry.
- **Mamad door:** looks like dark steel. The model has a generic white door.
- **Unexplained space** between the bathroom (x ≤ 812) and the en-suite (x ≥ 918).
- **Not measured:** hallway length, fin depth, niche size, bulkhead height and the balcony. All are marked as
  `assumptions` in the house file.
