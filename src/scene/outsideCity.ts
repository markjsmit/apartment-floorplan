import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import atlasMeta from '../../assets/outside/facade-atlas.json';

// The city around the tower in 3D (house cm, north = -z, before the scene's north rotation), everything the
// panorama can't be: what is below its bottom edge (tan -0.42 under the eye, ~205 m out on the ground) and what is
// so close that walking from window to window shifts it. Three meshes:
//  - towers: the stone neighbour tower (its face rectified from Mark's balcony pan, one continuous face, its lower
//    storeys whole floors of it), our own tower's shell and balcony stack below the flat, the lower parts of the three
//    nearest panorama towers (glass, Electra, construction: their last floors above the panorama edge carried down
//    to the street) and the long low roof (projected from the pan's first second) - all textured from one atlas;
//  - city: the low-rise blocks (3-6 storeys, light flat roofs with solar water heaters and stair huts), the walls of
//    the long low building, trees, cars - vertex colours over one small window texture;
//  - ghosts: depth-only volumes of the three panorama towers above their 3D bases, so nearer 3D things behind them
//    hide like they would behind the real tower (the panorama shows the tower there).
// The ground (streets, the little park, gardens, shadows) is painted on a canvas (groundCanvas).
//
// Layout: Mark's description of the area (no map imagery used) and the pan: the park east / north-east, streets
// north-south and east-west, offices west, the long low roof and the Ayalon highway with its railway south-west.

/** Ground level (house y, cm): the flat is on the 27th floor, ~85 m up. */
export const GROUND_Y = -8500;
/** Where Mark stood for the pan (balcony middle, eye 160 cm over the floor): the panorama and the rectified facades
 * were taken from here, so seen from here they meet exactly. */
export const EYE: [number, number] = [200, -150];
const EYE_Y = 160;
/** Our own tower (estimated: the flat is its north-west corner flat), the city grid's origin. */
const TOWER: { x: [number, number]; z: [number, number] } = { x: [-25, 2575], z: [-15, 2385] };
const O: [number, number] = [(TOWER.x[0] + TOWER.x[1]) / 2, (TOWER.z[0] + TOWER.z[1]) / 2];
const DEG = Math.PI / 180;
/** Compass direction in house (x, z): bearing 0 = north = -z, 90 = east. */
const dir = (b: number): [number, number] => [Math.sin(b * DEG), -Math.cos(b * DEG)];
const DU = dir(0);
const DV = dir(90);
/** A box turned by ROT lines up with the city grid (its width along V). */
const ROT = 0;
/** City grid (U north, V east, metres from our tower's centre) -> house cm. */
export const grid = (u: number, v: number): [number, number] => [O[0] + (u * DU[0] + v * DV[0]) * 100, O[1] + (u * DU[1] + v * DV[1]) * 100];
const toGrid = (x: number, z: number): [number, number] => {
  const dx = (x - O[0]) / 100;
  const dz = (z - O[1]) / 100;
  return [dx * DU[0] + dz * DU[1], dx * DV[0] + dz * DV[1]];
};
/** Half size of the painted ground (m), round our tower. */
export const GROUND_HALF = 256;

// ---------------------------------------------------------------------------------------------------------------
// geometry builder: quads with colour (linear) and uv

class Mesh {
  pos: number[] = [];
  col: number[] = [];
  uv: number[] = [];
  /** quad a b c d (counter-clockwise seen from the front), uvs per corner, colour per corner */
  quad(p: number[][], uv: number[][], c: number[][]) {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      this.pos.push(p[i][0], p[i][1], p[i][2]);
      this.uv.push(uv[i][0], uv[i][1]);
      this.col.push(c[i][0], c[i][1], c[i][2]);
    }
  }
  tri(p: number[][], uv: number[][], c: number[]) {
    for (let i = 0; i < 3; i++) {
      this.pos.push(p[i][0], p[i][1], p[i][2]);
      this.uv.push(uv[i][0], uv[i][1]);
      this.col.push(c[0], c[1], c[2]);
    }
  }
  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

const lin = (hex: string): number[] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};
const mul = (c: number[], k: number): number[] => [c[0] * k, c[1] * k, c[2] * k];
// the pan is late afternoon: sun from the west-south-west; faces turned to it lighter, the rest in soft shade
const SUN = dir(-105);
const shade = (nx: number, nz: number) => 0.56 + 0.4 * Math.max(0, nx * SUN[0] + nz * SUN[1]);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------------------------
// atlas rects (facade-atlas.json, from the pan; scratchpad scripts documented in assets/outside/source.json)

type Rect = { u0: number; u1: number; v0: number; v1: number };
const [AW, AH] = atlasMeta.size;
function rect(name: keyof typeof atlasMeta.rects, px?: [number, number, number, number]): Rect {
  const [x, y, w, h] = px ?? atlasMeta.rects[name];
  // textures are flipped: v = 1 at the image's top row
  return { u0: x / AW, u1: (x + w) / AW, v0: 1 - (y + h) / AH, v1: 1 - y / AH };
}
const sub = (r: Rect, a0: number, a1: number, b0: number, b1: number): Rect => ({
  u0: r.u0 + (r.u1 - r.u0) * a0, u1: r.u0 + (r.u1 - r.u0) * a1, v0: r.v0 + (r.v1 - r.v0) * b0, v1: r.v0 + (r.v1 - r.v0) * b1,
});
const WHITE = [1, 1, 1];

/**
 * A vertical face from (x0,z0) to (x1,z1), seen from the side where that runs left to right (its normal is
 * (-dz, dx)), from y0 to y1, tiled with `r` every `tw` x `th` cm, tiles anchored at the face's start and its top
 * (`fromTop`) or bottom.
 */
function tiledFace(m: Mesh, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, r: Rect, tw: number, th: number, k: number, fromTop = true) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ux = (x1 - x0) / len;
  const uz = (z1 - z0) / len;
  const c = mul(WHITE, k);
  for (let a = 0; a < len - 1; a += tw) {
    const a1 = Math.min(len, a + tw);
    const fa = (a1 - a) / tw;
    const rows: [number, number][] = [];
    if (fromTop) for (let t = y1; t > y0 + 1; t -= th) rows.push([Math.max(y0, t - th), t]);
    else for (let t = y0; t < y1 - 1; t += th) rows.push([t, Math.min(y1, t + th)]);
    for (const [b0, b1] of rows) {
      const tr = fromTop ? sub(r, 0, fa, 1 - (b1 - b0) / th, 1) : sub(r, 0, fa, 0, (b1 - b0) / th);
      const p0 = [x0 + ux * a, b0, z0 + uz * a];
      const p1 = [x0 + ux * a1, b0, z0 + uz * a1];
      m.quad([p0, p1, [p1[0], b1, p1[2]], [p0[0], b1, p0[2]]], [[tr.u0, tr.v0], [tr.u1, tr.v0], [tr.u1, tr.v1], [tr.u0, tr.v1]], [c, c, c, c]);
    }
  }
}

/** Shoelace sum in (x, z): > 0 = clockwise seen from above (x right, north up). */
const winding = (fp: [number, number][]) => fp.reduce((a, [x0, z0], i) => {
  const [x1, z1] = fp[(i + 1) % fp.length];
  return a + x0 * z1 - x1 * z0;
}, 0);

/** Flat roof quad (y) over four corners (any winding), facing up. */
function roof(m: Mesh, corners: [number, number][], y: number, r: Rect, k = 0.95, uvs?: number[][]) {
  const c = mul(WHITE, k);
  const t = sub(r, 0.2, 0.8, 0.2, 0.8);
  let uv = uvs ?? [[t.u0, t.v0], [t.u1, t.v0], [t.u1, t.v1], [t.u0, t.v1]];
  let p = corners.map(([x, z]) => [x, y, z]);
  // seen from above it must run counter-clockwise
  if (winding(corners) > 0) {
    p = [p[0], p[3], p[2], p[1]];
    uv = [uv[0], uv[3], uv[2], uv[1]];
  }
  m.quad(p, uv, [c, c, c, c]);
}

// ---------------------------------------------------------------------------------------------------------------
// the neighbour tower (the cream-stone one ~23 m north-west of the balcony)

/**
 * Its south-east face, from the balcony pan (1.6-3.7 s): one plane facing bearing 140 (towards us) whose nearest
 * point is 23.4 m from the balcony at bearing -40 - with 3.10 m floors that is what the pan shows (133 px per floor at
 * 1470 px focal length). s = along the face (cm, + towards north-east), h = above our eye (cm).
 */
export const NEIGHBOUR = { m: -40, d: 2340 };
const F = atlasMeta.face;
// the face's parts, left to right: a stack of balconies, the lower wing (roof garden), the main block, and the right
// part (dark bay + stone column) which goes above the frames: 2 floors more estimated (~34 storeys, roof ~106 m)
const PARTS = [
  { x0: F.parts.balc, x1: F.parts.wing, top: F.roofRows.balc, depth: 300 },
  { x0: F.parts.wing, x1: F.parts.main, top: F.roofRows.wing, depth: 1600 },
  { x0: F.parts.main, x1: F.parts.right, top: F.roofRows.main, depth: 2200 },
  { x0: F.parts.right, x1: 1262, top: F.roofRows.right, depth: 2200 },
];
const FLOOR = F.floorPx * F.cmPerPx; // 310 cm

/** Point on a face plane seen from the eye: bearing m, distance d, s along it, `back` behind it (cm). */
function facePoint(m: number, d: number, s: number, back = 0): [number, number] {
  const n = dir(m);
  const t = dir(m + 90);
  return [EYE[0] + n[0] * (d + back) + t[0] * s, EYE[1] + n[1] * (d + back) + t[1] * s];
}

function neighbour(m: Mesh) {
  const { m: mb, d } = NEIGHBOUR;
  const face = rect('face');
  const [fw, fh] = [atlasMeta.rects.face[2], atlasMeta.rects.face[3]];
  const sOf = (x: number) => F.s0 + x * F.cmPerPx;
  const hOf = (row: number) => F.h1 - row * F.cmPerPx;
  const cutH = hOf(F.cutRow);
  const lobbyTop = GROUND_Y - EYE_Y + 600;
  const n = dir(mb);
  for (const p of PARTS) {
    const s0 = sOf(p.x0);
    const s1 = sOf(p.x1);
    const topH = hOf(p.top);
    const [ax, az] = facePoint(mb, d, s0);
    const [bx, bz] = facePoint(mb, d, s1);
    // the photographed part of the face, one piece
    const r = sub(face, p.x0 / fw, p.x1 / fw, 1 - F.cutRow / fh, 1 - p.top / fh);
    const yC = EYE_Y + cutH;
    const yT = EYE_Y + topH;
    m.quad([[ax, yC, az], [bx, yC, bz], [bx, yT, bz], [ax, yT, az]], [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]], [WHITE, WHITE, WHITE, WHITE]);
    // below the video: its own typical floors, three at a time (band A, band B, A, ...), whole floors only
    const bandA = rect('bandA');
    const bandB = rect('bandB');
    const bh = 3 * FLOOR;
    let k = 0;
    for (let t = EYE_Y + cutH; t > lobbyTop + EYE_Y + 1; t -= bh, k++) {
      const b0 = Math.max(lobbyTop + EYE_Y, t - bh);
      const band = k % 2 ? bandB : bandA;
      const br = sub(band, p.x0 / fw, p.x1 / fw, 1 - (t - b0) / bh, 1);
      m.quad([[ax, b0, az], [bx, b0, bz], [bx, t, bz], [ax, t, az]], [[br.u0, br.v0], [br.u1, br.v0], [br.u1, br.v1], [br.u0, br.v1]], [WHITE, WHITE, WHITE, WHITE]);
    }
    // the lobby (6 m)
    const lr = sub(rect('lobby'), p.x0 / fw, p.x1 / fw, 0, 1);
    m.quad([[ax, GROUND_Y, az], [bx, GROUND_Y, bz], [bx, lobbyTop + EYE_Y, bz], [ax, lobbyTop + EYE_Y, az]], [[lr.u0, lr.v0], [lr.u1, lr.v0], [lr.u1, lr.v1], [lr.u0, lr.v1]], [WHITE, WHITE, WHITE, WHITE]);
    // sides and back: its stone column with windows, all the way down
    const [cx, cz] = facePoint(mb, d, s1, p.depth);
    const [ex, ez] = facePoint(mb, d, s0, p.depth);
    const side = rect('side');
    const kL = shade(-dir(mb + 90)[0], -dir(mb + 90)[1]);
    const kR = shade(dir(mb + 90)[0], dir(mb + 90)[1]);
    const kB = shade(n[0], n[1]);
    tiledFace(m, bx, bz, cx, cz, GROUND_Y, yT, side, 680, 930, kR);
    tiledFace(m, cx, cz, ex, ez, GROUND_Y, yT, side, 680, 930, kB);
    tiledFace(m, ex, ez, ax, az, GROUND_Y, yT, side, 680, 930, kL);
    roof(m, [[ax, az], [bx, bz], [cx, cz], [ex, ez]], yT, rect('gravel'));
  }
  // the wing's roof garden and railing, a cut-out standing on its front edge
  const wing = PARTS[1];
  const [ax, az] = facePoint(mb, d, sOf(wing.x0));
  const [bx, bz] = facePoint(mb, d, sOf(wing.x1));
  const r = sub(face, wing.x0 / fw, wing.x1 / fw, 1 - wing.top / fh, 1 - F.plantsTop / fh);
  const y0 = EYE_Y + hOf(wing.top);
  const y1 = EYE_Y + hOf(F.plantsTop);
  m.quad([[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]], [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]], [WHITE, WHITE, WHITE, WHITE]);
}

/** The neighbour tower's footprint corners (house cm) - for keeping the generated city off it. */
function neighbourFootprint(): [number, number][] {
  const { m: mb, d } = NEIGHBOUR;
  const s0 = F.s0;
  const s1 = F.s0 + 1262 * F.cmPerPx;
  return [facePoint(mb, d, s0), facePoint(mb, d, s1), facePoint(mb, d, s1, 2200), facePoint(mb, d, s0, 2200)];
}

// ---------------------------------------------------------------------------------------------------------------
// our own tower below the flat

function ownTower(m: Mesh) {
  const side = rect('side');
  const top = -35; // under our floor slab
  const [x0, x1] = TOWER.x;
  const [z0, z1] = TOWER.z;
  const B = -265; // the balconies' front
  const low = GROUND_Y + 600;
  // north (east of the balcony stack), east, south, west; each runs so that its outside is on the right
  const faces: [number, number, number, number, number][] = [
    [x1, z0, 410, z0, shade(0, -1)], [x1, z1, x1, z0, shade(1, 0)], [x0, z1, x1, z1, shade(0, 1)], [x0, z0, x0, z1, shade(-1, 0)],
  ];
  for (const [ax, az, bx, bz, k] of faces) tiledFace(m, ax, az, bx, bz, low, top, side, 680, 930, k);
  // the balcony stack under ours: slab edge, glass railing and the shade behind, floor after floor (308 cm), down
  // to the lobby
  const balc = rect('balcony');
  tiledFace(m, 410, B, x0, B, low, -40, balc, 410, 308, shade(0, -1));
  tiledFace(m, x0, B, x0, z0, low, -40, balc, 410, 308, shade(-1, 0));
  tiledFace(m, 410, z0, 410, B, low, -40, side, 680, 930, shade(1, 0));
  const lobby = rect('lobby');
  for (const [ax, az, bx, bz, k] of [[x1, B, x0, B, shade(0, -1)], ...faces.slice(1)] as [number, number, number, number, number][]) {
    tiledFace(m, ax, az, bx, bz, GROUND_Y, low, lobby, 3200, 600, k, false);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// the panorama's three nearest towers: their bases in 3D

/**
 * m = bearing of the face's normal from the balcony, d = its distance, s0..s1 = the face (cm, from the pan's
 * bearings: glass -164..-151.6, Electra -120.8..-102.4, construction -103.6..-79), top = the tower's top (h above
 * the eye, cm) for its depth-only volume. Distances from the floor heights in the pan (39 / 23 / 37 px a floor).
 */
const PANO_TOWERS = [
  { name: 'glass' as const, m: -160.5, d: 9770, s0: -598, s1: 1530, depth: 2100, top: 5450, tile: 758 },
  { name: 'electra' as const, m: -111.6, d: 16000, s0: -2592, s1: 2592, depth: 4500, top: 8900, tile: 732 },
  { name: 'construction' as const, m: -92, d: 8900, s0: -1827, s1: 2055, depth: 3000, top: 2370, tile: 656 },
];
/** The panorama's bottom edge: tan(elevation) = -0.42; a base reaches 1 m over it. */
const PANO_BOTTOM = -0.42;

function panoTowers(m: Mesh, ghost: Mesh) {
  for (const t of PANO_TOWERS) {
    const baseTop = EYE_Y + PANO_BOTTOM * t.d + 100;
    const a = facePoint(t.m, t.d, t.s0);
    const b = facePoint(t.m, t.d, t.s1);
    const c = facePoint(t.m, t.d, t.s1, t.depth);
    const e = facePoint(t.m, t.d, t.s0, t.depth);
    const r = rect(t.name);
    const w = t.s1 - t.s0;
    // the front: its last two floors repeated down to the street, one band across the whole width
    tiledFace(m, a[0], a[1], b[0], b[1], GROUND_Y, baseTop, r, w, t.tile, 1);
    const sideR = sub(r, 0, Math.min(1, t.depth / w), 0, 1);
    tiledFace(m, b[0], b[1], c[0], c[1], GROUND_Y, baseTop, sideR, t.depth, t.tile, 0.8);
    tiledFace(m, e[0], e[1], a[0], a[1], GROUND_Y, baseTop, sideR, t.depth, t.tile, 0.75);
    // above the base the panorama shows it: there, a depth-only volume (closed, seen from any side)
    const y0 = baseTop;
    const y1 = EYE_Y + t.top;
    const corners = [a, b, c, e];
    for (let i = 0; i < 4; i++) {
      const p = corners[i];
      const q = corners[(i + 1) % 4];
      ghost.quad([[p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]]], [[0, 0], [0, 0], [0, 0], [0, 0]], [WHITE, WHITE, WHITE, WHITE]);
    }
    ghost.quad([[a[0], y0, a[1]], [b[0], y0, b[1]], [c[0], y0, c[1]], [e[0], y0, e[1]]], [[0, 0], [0, 0], [0, 0], [0, 0]], [WHITE, WHITE, WHITE, WHITE]);
    ghost.quad([[a[0], y1, a[1]], [b[0], y1, b[1]], [c[0], y1, c[1]], [e[0], y1, e[1]]], [[0, 0], [0, 0], [0, 0], [0, 0]], [WHITE, WHITE, WHITE, WHITE]);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// the long low building south-west (frames 0-1 s): ~100 x 30 m, 16.6 m high, its roof projected from the pan

/** Eye-relative metres (x east, z south) of the ends of its long axis, from projecting frames 0-0.8 s onto a plane
 * 70 m under the eye (its roof). */
const LONG = { n: [-77, 30], f: [-113, 128], half: 15, length: 100, height: 1660 };

function longBuilding(atlas: Mesh, city: Mesh) {
  const [nx, nz] = LONG.n;
  const [fx, fz] = LONG.f;
  const L = Math.hypot(fx - nx, fz - nz);
  const ax = (fx - nx) / L;
  const az = (fz - nz) / L;
  const [px, pz] = [-az, ax];
  const at = (u: number, v: number): [number, number] => [EYE[0] + (nx + ax * u + px * v) * 100, EYE[1] + (nz + az * u + pz * v) * 100];
  // corners: row 0 of the roof image is v = -half
  const c00 = at(0, -LONG.half);
  const c10 = at(LONG.length, -LONG.half);
  const c11 = at(LONG.length, LONG.half);
  const c01 = at(0, LONG.half);
  const y = GROUND_Y + LONG.height;
  const r = rect('roofLong');
  // image x runs along u, image y along v (top row = -half)
  roof(atlas, [c00, c10, c11, c01], y, r, 1, [[r.u0, r.v1], [r.u1, r.v1], [r.u1, r.v0], [r.u0, r.v0]]);
  // walls: office floors (4.1 m), light grey with window bands
  const fp: [number, number][] = [c00, c10, c11, c01];
  walls(city, fp, GROUND_Y, y, lin('#c9c7c0'), 410, true);
}

// ---------------------------------------------------------------------------------------------------------------
// window texture (made at runtime): one floor (300 cm) of two windows on a 600 cm wall, plus a plain patch that
// roofs, trees and cars use (only their vertex colour shows)

const WIN_TILE: [number, number] = [600, 300];
export function windowCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  const px = 256 / 600;
  const py = 128 / 300;
  const box = (x: number, h0: number, w: number, h: number, fill: string) => {
    g.fillStyle = fill;
    g.fillRect(x * px, 128 - (h0 + h) * py, w * px, h * py);
  };
  box(0, 0, 600, 300, '#ecebe5');
  // left bay: a balcony (the Tel Aviv kind): solid parapet to 100 cm, the shaded recess behind it with a glass door
  box(0, 100, 300, 175, '#30363b');
  box(40, 100, 200, 165, '#46515a');
  box(138, 100, 4, 165, '#2a3035');
  box(0, 96, 300, 6, '#f4f3ee');
  box(0, 275, 300, 25, '#d9d8d1');
  // right bay: a window with its shutter half down, a sill, an AC unit under it
  box(345, 90, 170, 145, '#9a9a96');
  box(350, 95, 160, 135, '#3d454c');
  box(350, 160, 160, 70, '#c9c9c4');
  box(429, 95, 2, 65, '#5a6269');
  box(340, 84, 180, 6, '#dcdcd6');
  box(530, 30, 60, 40, '#cfd0cc');
  // the floor slab line
  box(0, 0, 600, 8, '#dcdcd5');
  return c;
}
const PLAIN: [number, number] = [0.72, 0.15];

/** Walls round a footprint (any winding), cm-tiled windows; bottom edge darker (soft contact shade). */
function walls(m: Mesh, fp: [number, number][], y0: number, y1: number, col: number[], floorH = 300, office = false) {
  // winding: make it counter-clockwise seen from above (normals out)
  let area = 0;
  for (let i = 0; i < fp.length; i++) {
    const [x0, z0] = fp[i];
    const [x1, z1] = fp[(i + 1) % fp.length];
    area += x0 * z1 - x1 * z0;
  }
  const pts = area < 0 ? fp : [...fp].reverse();
  // start the window bays somewhere different on every building
  let along = Math.abs(fp[0][0] * 0.37 + fp[0][1] * 0.61) % WIN_TILE[0];
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x1 - x0, z1 - z0);
    // running counter-clockwise seen from above, the outside is on the right: normal (-dz, dx)
    const nx = -(z1 - z0) / len;
    const nz = (x1 - x0) / len;
    const k = shade(nx, nz);
    const top = mul(col, k);
    const bot = mul(col, k * 0.72);
    const u0 = along / WIN_TILE[0];
    const u1 = (along + len) / WIN_TILE[0];
    const v1 = (y1 - y0) / (office ? floorH : WIN_TILE[1]);
    if (office) {
      m.quad([[x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0]], [[u0, 0], [u1, 0], [u1, v1], [u0, v1]], [bot, bot, top, top]);
    } else {
      // on pilotis, Tel Aviv style: the ground floor an open, shaded storey (entrance, parking, bins)
      const yp = y0 + 260;
      const dark = mul(col, k * 0.42);
      m.quad([[x0, y0, z0], [x1, y0, z1], [x1, yp, z1], [x0, yp, z0]], [PLAIN, PLAIN, PLAIN, PLAIN], [mul(dark, 0.8), mul(dark, 0.8), dark, dark]);
      const vp = 260 / WIN_TILE[1];
      m.quad([[x0, yp, z0], [x1, yp, z1], [x1, y1, z1], [x0, y1, z0]], [[u0, vp], [u1, vp], [u1, v1], [u0, v1]], [mul(col, k * 0.85), mul(col, k * 0.85), top, top]);
    }
    along += len;
  }
}

/** A box (rotated rectangle footprint) with walls and a roof, all plain (vertex colour only). */
function solid(m: Mesh, cx: number, cz: number, w: number, d: number, y0: number, y1: number, rot: number, col: number[], roofK = 1) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const fp: [number, number][] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, b]) => [cx + a * c - b * s, cz + a * s + b * c]);
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = fp[i];
    const [x1, z1] = fp[(i + 1) % 4];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const k = shade((z1 - z0) / len, -(x1 - x0) / len);
    // fp runs clockwise seen from above (x right, z down) -> this order faces out
    const cc = mul(col, k);
    m.quad([[x1, y0, z1], [x0, y0, z0], [x0, y1, z0], [x1, y1, z1]], [PLAIN, PLAIN, PLAIN, PLAIN], [cc, cc, cc, cc]);
  }
  const t = mul(col, roofK);
  m.quad([[fp[0][0], y1, fp[0][1]], [fp[3][0], y1, fp[3][1]], [fp[2][0], y1, fp[2][1]], [fp[1][0], y1, fp[1][1]]], [PLAIN, PLAIN, PLAIN, PLAIN], [t, t, t, t]);
}

// ---------------------------------------------------------------------------------------------------------------
// trees and cars

const TREE_GREENS = ['#3e5a2b', '#4c6a32', '#5a7a3a', '#6f8a45', '#34502a', '#7d8f4f', '#47632f', '#58703a'].map(lin);
/** A low-poly crown (top, an upper and a wider middle ring, a point under it: 28 triangles) on a short trunk. */
function tree(m: Mesh, x: number, z: number, r: number, h: number, col: number[], conifer = false) {
  const trunkH = conifer ? h * 0.12 : h * 0.35;
  solid(m, x, z, 35, 35, GROUND_Y, GROUND_Y + trunkH + 60, 0, lin('#5b4a3a'), 0.8);
  if (conifer) r *= 0.45;
  const n = 7;
  const yMid = GROUND_Y + trunkH + (h - trunkH) * (conifer ? 0.3 : 0.45);
  const yUp = GROUND_Y + trunkH + (h - trunkH) * (conifer ? 0.65 : 0.8);
  const top = [x, GROUND_Y + h, z];
  const bottom = [x, GROUND_Y + trunkH, z];
  const mid: number[][] = [];
  const up: number[][] = [];
  const seed = Math.floor(Math.abs(x * 0.37 + z * 0.61));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (seed % 7);
    const j = 0.82 + 0.36 * (((seed + i * 5) % 7) / 7);
    mid.push([x + Math.cos(a) * r * j, yMid, z + Math.sin(a) * r * j]);
    up.push([x + Math.cos(a + 0.45) * r * 0.62 * j, yUp, z + Math.sin(a + 0.45) * r * 0.62 * j]);
  }
  const tone = (a: number[], b: number[], lift: number) => {
    const mx = (a[0] + b[0]) / 2 - x;
    const mz = (a[2] + b[2]) / 2 - z;
    const l = Math.hypot(mx, mz) || 1;
    return mul(col, lift * (0.7 + 0.45 * Math.max(0, (mx / l) * SUN[0] + (mz / l) * SUN[1])));
  };
  for (let i = 0; i < n; i++) {
    const p = mid[i];
    const q = mid[(i + 1) % n];
    const u = up[i];
    const w = up[(i + 1) % n];
    m.tri([top, w, u], [PLAIN, PLAIN, PLAIN], tone(u, w, 1.15));
    m.tri([u, w, q], [PLAIN, PLAIN, PLAIN], tone(p, q, 1.0));
    m.tri([u, q, p], [PLAIN, PLAIN, PLAIN], tone(p, q, 0.95));
    m.tri([bottom, p, q], [PLAIN, PLAIN, PLAIN], mul(col, 0.45));
  }
}
const someGreen = (rand: () => number) => TREE_GREENS[Math.floor(rand() * TREE_GREENS.length)];

const CAR_COLOURS = ['#e8e8e6', '#e8e8e6', '#2b2d30', '#8d9095', '#b7b9bc', '#9b2a24', '#34495e', '#d9d4c7', '#1f3b5a'].map(lin);
function car(m: Mesh, x: number, z: number, rot: number, col: number[]) {
  solid(m, x, z, 440, 180, GROUND_Y + 25, GROUND_Y + 100, rot, col, 1);
  solid(m, x - Math.cos(rot) * 20, z - Math.sin(rot) * 20, 240, 160, GROUND_Y + 100, GROUND_Y + 145, rot, mul(col, 0.55), 0.9);
}

// ---------------------------------------------------------------------------------------------------------------
// the city plan (grid metres: U north, V east, from our tower's centre), after Mark's description of the area:
// directly east and north-east a big wooded park with a street along its west edge (parked cars both sides: the
// street at the pan's right edge, 6.5-7.3 s); west, across a north-south street, office towers with square roofs
// (and the pan's construction tower, Electra and the long low building); south mid-rise blocks; north, past the
// neighbour tower, the low-rise neighbourhood of the pan's north view.

type Seg = { at: number; from: number; to: number };
const ROAD = 8;
const WALK = 3.5;
const EDGE = ROAD / 2 + WALK;
/** Streets running east-west (constant U) and north-south (constant V); carriageway 8 m, pavements 3.5 m. */
const ROADS_EW: Seg[] = [
  { at: 66, from: -256, to: 60 }, { at: -30, from: -256, to: 60 }, { at: 150, from: -256, to: 60 }, { at: 230, from: -256, to: 60 },
  { at: -110, from: -256, to: 256 }, { at: -190, from: -256, to: 256 }, { at: 66, from: 205, to: 256 },
];
const ROADS_NS: Seg[] = [
  { at: 60, from: -256, to: 256 }, { at: -60, from: -256, to: 256 }, { at: -140, from: -256, to: 256 }, { at: -215, from: -256, to: 256 },
  { at: 205, from: -256, to: 256 },
];
/** The Ayalon (lanes, the railway, lanes) south-west, heading 130° (from the pan's first second). */
const HIGHWAY = { u: -172, v: -165, slope: -0.839, cos: 0.766, half: 38 };
const highwayU = (v: number) => HIGHWAY.u + HIGHWAY.slope * (v - HIGHWAY.v);
/** The home block: our tower, its plaza and garden, the neighbour tower */
const HOME = { u: [-30 + EDGE, 66 - EDGE], v: [-60 + EDGE, 60 - EDGE] };
/** The park east and north-east */
const PARK = { u: [-110 + EDGE, 256], v: [60 + EDGE, 205 - EDGE] };
const inPark = (u: number, v: number, pad = 0) => u > PARK.u[0] - pad && u < PARK.u[1] + pad && v > PARK.v[0] - pad && v < PARK.v[1] + pad;
/** Open lawns in the park (u, v, radius m) and its paths (polylines) */
const LAWNS: [number, number, number][] = [[20, 110, 22], [120, 150, 26], [-60, 130, 18], [190, 95, 20]];
const PATHS: [number, number][][] = [
  [[-102, 72], [-40, 95], [20, 88], [70, 120], [140, 118], [200, 140], [256, 132]],
  [[0, 68], [30, 130], [60, 190]], [[110, 68], [150, 110], [170, 190]], [[-80, 190], [-20, 150], [40, 160]],
];

export type Plan = {
  lots: { u: number; v: number; w: number; d: number; kind: 'garden' | 'paved' | 'parking' }[];
  buildings: { fp: [number, number][]; h: number }[];
  trees: { x: number; z: number; r: number }[];
};

/** Reserved areas (house cm): the towers and the long building, kept free of generated blocks. */
function reserved(): { c: [number, number]; r: number }[] {
  const out: { c: [number, number]; r: number }[] = [];
  const nb = neighbourFootprint();
  out.push({ c: [(nb[0][0] + nb[2][0]) / 2, (nb[0][1] + nb[2][1]) / 2], r: 2200 });
  for (const t of PANO_TOWERS) {
    const a = facePoint(t.m, t.d, (t.s0 + t.s1) / 2, t.depth / 2);
    out.push({ c: a, r: Math.hypot(t.s1 - t.s0, t.depth) / 2 + 300 });
  }
  const [nx, nz] = LONG.n;
  const [fx, fz] = LONG.f;
  for (let i = 0; i <= 6; i++) {
    const k = i / 6;
    out.push({ c: [EYE[0] + (nx + (fx - nx) * k) * 100, EYE[1] + (nz + (fz - nz) * k) * 100], r: 1900 });
  }
  return out;
}

/** The big towers' and the long building's footprints (house cm), for a closer fit than the circles above. */
function footprints(): [number, number][][] {
  const out: [number, number][][] = [neighbourFootprint()];
  for (const t of PANO_TOWERS) out.push([facePoint(t.m, t.d, t.s0), facePoint(t.m, t.d, t.s1), facePoint(t.m, t.d, t.s1, t.depth), facePoint(t.m, t.d, t.s0, t.depth)]);
  const [nx, nz] = LONG.n;
  const [fx, fz] = LONG.f;
  const L = Math.hypot(fx - nx, fz - nz);
  const [ax, az] = [(fx - nx) / L, (fz - nz) / L];
  const at = (u: number, v: number): [number, number] => [EYE[0] + (nx + ax * u - az * v) * 100, EYE[1] + (nz + az * u + ax * v) * 100];
  out.push([at(0, -LONG.half), at(LONG.length, -LONG.half), at(LONG.length, LONG.half), at(0, LONG.half)]);
  out.push([[TOWER.x[0], -265], [TOWER.x[1], -265], [TOWER.x[1], TOWER.z[1]], [TOWER.x[0], TOWER.z[1]]]);
  return out;
}
/** Is (x, z) within `pad` cm of a convex footprint? */
function inside(fp: [number, number][], x: number, z: number, pad: number): boolean {
  const w = Math.sign(winding(fp));
  return fp.every(([x0, z0], i) => {
    const [x1, z1] = fp[(i + 1) % fp.length];
    const len = Math.hypot(x1 - x0, z1 - z0);
    // signed distance to the edge's line, positive inside
    return (w * ((x1 - x0) * (z - z0) - (z1 - z0) * (x - x0))) / len > -pad;
  });
}

export type City = { towers: BufferGeometry; city: BufferGeometry; ghosts: BufferGeometry; plan: Plan };

export function buildCity(): City {
  const atlas = new Mesh();
  const city = new Mesh();
  const ghost = new Mesh();
  neighbour(atlas);
  ownTower(atlas);
  panoTowers(atlas, ghost);
  longBuilding(atlas, city);
  const plan: Plan = { lots: [], buildings: [], trees: [] };
  const rand = rng(27);
  const keepOut = reserved();
  const CHECKPOINT = { u: [136, 158], v: [-44, -20] };
  keepOut.push({ c: O, r: 1900 }, { c: grid(147, -32), r: 1700 });
  const free = (x: number, z: number, r: number) => keepOut.every((k) => Math.hypot(x - k.c[0], z - k.c[1]) > k.r + r);
  const fps = footprints();
  const clear = (x: number, z: number, pad: number) => !fps.some((fp) => inside(fp, x, z, pad));
  const inHighway = (u: number, v: number, pad = 0) => Math.abs(u - highwayU(v)) * HIGHWAY.cos < HIGHWAY.half + pad;
  const addTree = (u: number, v: number, r: number, h: number, conifer = false) => {
    const [x, z] = grid(u, v);
    plan.trees.push({ x, z, r: conifer ? r * 0.45 : r });
    tree(city, x, z, r, h, someGreen(rand), conifer);
  };

  const ROOFS = ['#e9e6df', '#dedad1', '#f1efe9', '#d4d1ca', '#e6e1d4', '#cfccc4', '#c9c6be'].map(lin);
  const WALLS = ['#e9dfca', '#ded3bd', '#efe6d4', '#d7cdb8', '#f0ebe0', '#cfc4ae', '#e6e0d2'].map(lin);
  const OFFICE = ['#c9cbcc', '#d8d6cf', '#b9bfc4', '#e0ddd5'].map(lin);
  const tankWhite = lin('#f2f2ee');
  const panelBlue = lin('#4d5d70');

  /** A building on a lot: walls, flat roof with a parapet, roof clutter; offices bigger and plainer. */
  const building = (cu: number, cv: number, bw: number, bd: number, floors: number, office: boolean) => {
    const floorH = office ? 380 : 300;
    const h = floors * floorH + 90;
    const corners: [number, number][] = [grid(cu - bw / 2, cv - bd / 2), grid(cu + bw / 2, cv - bd / 2), grid(cu + bw / 2, cv + bd / 2), grid(cu - bw / 2, cv + bd / 2)];
    const wall = office ? OFFICE[Math.floor(rand() * OFFICE.length)] : WALLS[Math.floor(rand() * WALLS.length)];
    const roofC = ROOFS[Math.floor(rand() * ROOFS.length)];
    walls(city, corners, GROUND_Y, GROUND_Y + h, wall, floorH, office);
    plan.buildings.push({ fp: corners, h });
    const y = GROUND_Y + h;
    roofQuad(city, corners, y, roofC);
    // parapet (90 cm) all round. A box turned by ROT has its width along V, its depth along U
    const rim = mul(roofC, 0.86);
    const t = 0.25;
    for (const sgn of [-1, 1]) {
      const [px, pz] = grid(cu + sgn * (bw / 2 - t / 2), cv);
      solid(city, px, pz, bd * 100, t * 100, y, y + 90, ROT, rim, 1.05);
      const [qx, qz] = grid(cu, cv + sgn * (bd / 2 - t / 2));
      solid(city, qx, qz, t * 100, bw * 100, y, y + 90, ROT, rim, 1.05);
    }
    const at = (k: number) => grid(cu + (rand() - 0.5) * (bw - k), cv + (rand() - 0.5) * (bd - k));
    if (office) {
      // plant rooms and cooling units: the square roofs of the satellite view
      const [mx, mz] = grid(cu, cv);
      solid(city, mx, mz, bd * 45, bw * 45, y, y + 350, ROT, mul(wall, 0.9), 0.95);
      for (let k = 0; k < 6; k++) {
        const [ax, az] = at(6);
        solid(city, ax, az, 300, 200, y, y + 160, ROT, lin('#bdbfbf'), 1);
      }
      return;
    }
    // a top floor set back on some (penthouse), a stair hut, solar water heaters (panels + tank), AC units
    if (floors > 2 && rand() < 0.35) {
      const [px, pz] = grid(cu + bw * 0.12, cv - bd * 0.1);
      solid(city, px, pz, bd * 55, bw * 55, y, y + 290, ROT, mul(wall, 0.98), 1);
    } else if (rand() < 0.7) {
      const [sx, sz] = at(5);
      solid(city, sx, sz, 300, 260, y, y + 240, ROT, mul(wall, 0.97), 0.95);
    }
    const heaters = 2 + Math.floor(rand() * (floors + 2));
    for (let k = 0; k < heaters; k++) {
      const hu = cu + (rand() - 0.5) * (bw - 4);
      const hv = cv + (rand() - 0.5) * (bd - 4);
      const [hx, hz] = grid(hu, hv);
      const [tx, tz] = grid(hu + 0.9, hv);
      solid(city, hx, hz, 200, 110, y, y + 60, ROT, panelBlue, 1.15);
      solid(city, tx, tz, 180, 55, y + 40, y + 120, ROT, tankWhite, 1);
    }
    for (let k = 0; k < 3; k++) {
      if (rand() < 0.5) continue;
      const [ax, az] = at(3);
      solid(city, ax, az, 90, 60, y, y + 70, ROT, lin('#d6d6d2'), 1);
    }
  };

  // blocks: the cells between the streets
  const us = [...new Set([-256, ...ROADS_EW.map((r) => r.at), 256])].sort((a, b) => a - b);
  const vs = [...new Set([-256, ...ROADS_NS.map((r) => r.at), 256])].sort((a, b) => a - b);
  for (let i = 0; i < us.length - 1; i++) {
    for (let j = 0; j < vs.length - 1; j++) {
      const u0 = us[i] + EDGE;
      const u1 = us[i + 1] - EDGE;
      const v0 = vs[j] + EDGE;
      const v1 = vs[j + 1] - EDGE;
      const mu = (u0 + u1) / 2;
      const mv = (v0 + v1) / 2;
      if (mu > HOME.u[0] && mu < HOME.u[1] && mv > HOME.v[0] && mv < HOME.v[1]) continue;
      if (inPark(mu, mv)) continue;
      // west of the west street: offices; north: villas and small blocks (2-4 storeys); the rest 4-7
      const zone = mv < -60 ? 'office' : mu > 66 ? 'villa' : 'mid';
      const alongU = u1 - u0 > v1 - v0;
      const L = alongU ? u1 - u0 : v1 - v0;
      const D = alongU ? v1 - v0 : u1 - u0;
      const rowsN = zone === 'office' ? 1 : D > 46 ? 2 : 1;
      for (let row = 0; row < rowsN; row++) {
        let a = 0;
        while (a < L - 8) {
          const fw = Math.min(L - a, zone === 'office' ? 34 + rand() * 14 : zone === 'villa' ? 15 + rand() * 9 : 20 + rand() * 10);
          const ld = D / rowsN;
          const lu = alongU ? u0 + a + fw / 2 : u0 + row * ld + ld / 2;
          const lv = alongU ? v0 + row * ld + ld / 2 : v0 + a + fw / 2;
          const lw = alongU ? fw : ld;
          const lh = alongU ? ld : fw;
          a += fw;
          if (Math.hypot(lu, lv) > 235 || inHighway(lu, lv, 10)) continue;
          if (lu > CHECKPOINT.u[0] - 4 && lu < CHECKPOINT.u[1] + 4 && lv > CHECKPOINT.v[0] - 4 && lv < CHECKPOINT.v[1] + 4) continue;
          const [lx, lz] = grid(lu, lv);
          if (!free(lx, lz, Math.max(lw, lh) * 45)) {
            // next to the big towers: an open car park (rows of cars where they fit), some trees
            if (!clear(lx, lz, 800)) continue;
            plan.lots.push({ u: lu, v: lv, w: lw, d: lh, kind: 'parking' });
            for (let cu = lu - lh / 2 + 4; cu < lu + lh / 2 - 3; cu += 6) {
              for (let cv = lv - lw / 2 + 2; cv < lv + lw / 2 - 1; cv += 2.6) {
                const [cx, cz] = grid(cu, cv);
                if (rand() < 0.72 && clear(cx, cz, 300)) car(city, cx, cz, -90 * DEG, CAR_COLOURS[Math.floor(rand() * CAR_COLOURS.length)]);
              }
            }
            continue;
          }
          const kind = rand() < (zone === 'villa' ? 0.12 : 0.55) ? 'paved' : 'garden';
          plan.lots.push({ u: lu, v: lv, w: lw, d: lh, kind });
          const bw = Math.max(8, lw - (zone === 'office' ? 8 : 6) - rand() * 4);
          const bd = Math.max(8, lh - (zone === 'office' ? 8 : 6) - rand() * 4);
          const floors = zone === 'office' ? 6 + Math.floor(rand() * 7) : zone === 'villa' ? (rand() < 0.3 ? 2 : rand() < 0.75 ? 3 : 4) : 4 + Math.floor(rand() * 4);
          const cu = lu + (rand() - 0.5) * Math.max(0, lw - bw - 4);
          const cv = lv + (rand() - 0.5) * Math.max(0, lh - bd - 4);
          building(cu, cv, bw, bd, floors, zone === 'office');
          // garden trees round the house (the pan's low-rise is as much trees as roofs)
          const n = kind === 'garden' ? (zone === 'villa' ? 4 : 2) + Math.floor(rand() * 4) : Math.floor(rand() * 2);
          for (let k = 0; k < n; k++) {
            const tu = lu + (rand() - 0.5) * (lw - 2);
            const tv = lv + (rand() - 0.5) * (lh - 2);
            if (Math.abs(tu - cu) < bw / 2 + 1.5 && Math.abs(tv - cv) < bd / 2 + 1.5) continue;
            addTree(tu, tv, 260 + rand() * 300, 650 + rand() * 650, rand() < 0.12);
          }
        }
      }
    }
  }
  // what is left between the blocks and round the big towers' plazas: trees, as on Tel Aviv's paved squares
  const onRoad = (u: number, v: number) => ROADS_EW.some((r) => Math.abs(u - r.at) < EDGE + 1 && v > r.from && v < r.to) ||
    ROADS_NS.some((r) => Math.abs(v - r.at) < EDGE + 1 && u > r.from && u < r.to);
  const inLot = (u: number, v: number) => plan.lots.some((l) => Math.abs(u - l.u) < l.d / 2 + 1 && Math.abs(v - l.v) < l.w / 2 + 1);
  for (let u = -232; u < 232; u += 8) {
    for (let v = -232; v < 232; v += 8) {
      const tu = u + (rand() - 0.5) * 6;
      const tv = v + (rand() - 0.5) * 6;
      if (Math.hypot(tu, tv) > 225 || rand() < 0.45) continue;
      if (inPark(tu, tv, 2) || (tu > HOME.u[0] - 1 && tu < HOME.u[1] + 1 && tv > HOME.v[0] - 1 && tv < HOME.v[1] + 1)) continue;
      if (onRoad(tu, tv) || inLot(tu, tv) || inHighway(tu, tv, 4)) continue;
      const [x, z] = grid(tu, tv);
      if (!clear(x, z, 500)) continue;
      addTree(tu, tv, 250 + rand() * 220, 650 + rand() * 450, rand() < 0.1);
    }
  }
  // the Check Point-like office block north (pan 3.6-4.0 s: ~8 storeys, white, window bands)
  building((CHECKPOINT.u[0] + CHECKPOINT.u[1]) / 2, (CHECKPOINT.v[0] + CHECKPOINT.v[1]) / 2, CHECKPOINT.u[1] - CHECKPOINT.u[0], CHECKPOINT.v[1] - CHECKPOINT.v[0], 8, true);

  // the park: a dense canopy (ficus, pines, a few cypresses) with open lawns and paths through it
  const nearPath = (u: number, v: number, w: number) => PATHS.some((pl) => pl.some((p, i) => {
    if (!i) return false;
    const [au, av] = pl[i - 1];
    const [bu, bv] = p;
    const l2 = (bu - au) ** 2 + (bv - av) ** 2;
    const t = Math.max(0, Math.min(1, ((u - au) * (bu - au) + (v - av) * (bv - av)) / l2));
    return Math.hypot(u - au - t * (bu - au), v - av - t * (bv - av)) < w;
  }));
  for (let u = PARK.u[0] + 2; u < PARK.u[1]; u += 7) {
    for (let v = PARK.v[0] + 2; v < PARK.v[1] - 1; v += 7) {
      const tu = u + (rand() - 0.5) * 6;
      const tv = v + (rand() - 0.5) * 6;
      if (Math.hypot(tu, tv) > 240 || rand() < 0.12) continue;
      if (LAWNS.some(([lu, lv, lr]) => Math.hypot(tu - lu, tv - lv) < lr)) continue;
      if (nearPath(tu, tv, 3)) continue;
      addTree(tu, tv, 380 + rand() * 260, 900 + rand() * 700, rand() < 0.15);
    }
  }
  // home block: the garden round our tower and between the towers (lawns, trees), the plaza in front
  for (let k = 0; k < 70; k++) {
    const u = HOME.u[0] + 2 + rand() * (HOME.u[1] - HOME.u[0] - 4);
    const v = HOME.v[0] + 2 + rand() * (HOME.v[1] - HOME.v[0] - 4);
    const [x, z] = grid(u, v);
    if (!free(x, z, 350)) continue;
    // the driveway south of our tower stays open
    if (u < -10 && Math.abs(v) < 10) continue;
    addTree(u, v, 300 + rand() * 250, 700 + rand() * 600, rand() < 0.2);
  }

  // streets: trees along the pavements, parked cars along the kerbs (both sides of the park street), a few driving
  const street = (ew: boolean, at: number, from: number, to: number) => {
    const p = (a: number, off: number) => (ew ? grid(at + off, a) : grid(a, at + off));
    const uvOf = (a: number, off: number): [number, number] => (ew ? [at + off, a] : [a, at + off]);
    const rot = ew ? 0 : -90 * DEG;
    const crossings = (ew ? ROADS_NS : ROADS_EW).map((r) => r.at);
    for (let a = from + 10; a < to - 10; a += 8 + rand() * 4) {
      if (crossings.some((c) => Math.abs(c - a) < 12)) continue;
      for (const side of [-1, 1]) {
        const [tu, tv] = uvOf(a, side * (EDGE - 1.2));
        if (Math.hypot(tu, tv) > 240 || inHighway(tu, tv, 4)) continue;
        const [tx, tz] = p(a, side * (EDGE - 1.2));
        if (free(tx, tz, 300) && rand() < 0.85) addTree(tu, tv, 240 + rand() * 180, 650 + rand() * 350);
        const parked = at === 60 ? 0.92 : 0.6;
        if (rand() < parked) {
          const [cu, cv] = uvOf(a + (rand() - 0.5) * 3, side * (ROAD / 2 - 1.1));
          const [cx, cz] = grid(cu, cv);
          if (free(cx, cz, 300) && !inHighway(cu, cv, 2)) car(city, cx, cz, rot, CAR_COLOURS[Math.floor(rand() * CAR_COLOURS.length)]);
        }
      }
      if (rand() < 0.1) {
        const [cu, cv] = uvOf(a, (rand() < 0.5 ? -1 : 1) * 1.6);
        const [cx, cz] = grid(cu, cv);
        if (Math.hypot(cu, cv) < 240 && free(cx, cz, 300) && !inHighway(cu, cv, 2)) car(city, cx, cz, rot, CAR_COLOURS[Math.floor(rand() * CAR_COLOURS.length)]);
      }
    }
  };
  for (const r of ROADS_EW) street(true, r.at, r.from, r.to);
  for (const r of ROADS_NS) street(false, r.at, r.from, r.to);
  // the highway: traffic in both directions
  for (let v = -256; v < 256; v += 5 + rand() * 9) {
    for (const lane of [-30, -26.5, -23, -19.5, 19.5, 23, 26.5, 30]) {
      if (rand() < 0.45) continue;
      const u = highwayU(v) + lane / HIGHWAY.cos;
      if (Math.hypot(u, v) > 250) continue;
      const [x, z] = grid(u, v);
      car(city, x, z, 40 * DEG, CAR_COLOURS[Math.floor(rand() * CAR_COLOURS.length)]);
    }
  }
  return { towers: atlas.geometry(), city: city.geometry(), ghosts: ghost.geometry(), plan };
}

/** A flat roof over four corners (any winding), facing up, plain. */
function roofQuad(m: Mesh, corners: [number, number][], y: number, col: number[]) {
  let p = corners.map(([x, z]) => [x, y, z]);
  if (winding(corners) > 0) p = [p[0], p[3], p[2], p[1]];
  m.quad(p, [PLAIN, PLAIN, PLAIN, PLAIN], [col, col, col, col]);
}

// ---------------------------------------------------------------------------------------------------------------
// the ground, painted: 2048 px over 512 x 512 m of the city grid (4 px a metre), north (U+) up

export function groundCanvas(plan: Plan): HTMLCanvasElement {
  const N = 2048;
  const K = N / (2 * GROUND_HALF);
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  const g = c.getContext('2d')!;
  const X = (v: number) => (v + GROUND_HALF) * K;
  const Y = (u: number) => (GROUND_HALF - u) * K;
  const rectUV = (u0: number, u1: number, v0: number, v1: number, fill: string) => {
    g.fillStyle = fill;
    g.fillRect(X(Math.min(v0, v1)), Y(Math.max(u0, u1)), Math.abs(v1 - v0) * K, Math.abs(u1 - u0) * K);
  };
  const poly = (pts: [number, number][], fill: string) => {
    g.fillStyle = fill;
    g.beginPath();
    pts.forEach(([x, z], i) => {
      const [u, v] = toGrid(x, z);
      if (i) g.lineTo(X(v), Y(u));
      else g.moveTo(X(v), Y(u));
    });
    g.closePath();
    g.fill();
  };
  const blob = (u: number, v: number, r: number, fill: string) => {
    g.fillStyle = fill;
    g.beginPath();
    g.ellipse(X(v), Y(u), r * K, r * K, 0, 0, Math.PI * 2);
    g.fill();
  };
  const r = rng(5);
  // base: city ground between things (paving / dust)
  g.fillStyle = '#a09a8b';
  g.fillRect(0, 0, N, N);
  // lots: gardens (green, mottled), paved yards
  for (const l of plan.lots) {
    rectUV(l.u - l.d / 2 + 0.5, l.u + l.d / 2 - 0.5, l.v - l.w / 2 + 0.5, l.v + l.w / 2 - 0.5, l.kind === 'garden' ? '#66703f' : l.kind === 'parking' ? '#57585a' : '#aaa393');
    if (l.kind === 'parking') {
      for (let u = l.u - l.d / 2 + 1; u < l.u + l.d / 2 - 1; u += 6) for (let v = l.v - l.w / 2 + 0.7; v < l.v + l.w / 2; v += 2.6) rectUV(u, u + 5, v, v + 0.1, '#d4d2ca');
    }
    if (l.kind === 'garden') for (let k = 0; k < 6; k++) blob(l.u + (r() - 0.5) * l.d, l.v + (r() - 0.5) * l.w, 1.5 + r() * 3, r() < 0.5 ? '#58623a' : '#76804c');
  }
  // the home block: plaza (light stone) round the towers, lawns in the garden, the driveway down to the car park
  rectUV(HOME.u[0], HOME.u[1], HOME.v[0], HOME.v[1], '#bdb6a6');
  rectUV(HOME.u[0] + 3, HOME.u[1] - 3, 17, HOME.v[1] - 3, '#62803c');
  rectUV(16, HOME.u[1] - 3, -14, 17, '#62803c');
  rectUV(-16, 16, HOME.v[0] + 3, -15, '#62803c');
  rectUV(HOME.u[0], -13, -6, 6, '#48494a');
  g.strokeStyle = '#e8e4d8';
  g.lineWidth = 0.4 * K;
  for (let k = -6; k < 6; k += 1.6) {
    g.beginPath();
    g.moveTo(X(k), Y(-14));
    g.lineTo(X(k + 2), Y(-17));
    g.stroke();
  }
  // the park: under the canopy shady ground and leaf litter, the lawns, the paths
  rectUV(PARK.u[0], PARK.u[1], PARK.v[0], PARK.v[1], '#4d5a33');
  for (let k = 0; k < 900; k++) {
    blob(PARK.u[0] + r() * (PARK.u[1] - PARK.u[0]), PARK.v[0] + r() * (PARK.v[1] - PARK.v[0]), 2 + r() * 5, ['#45522d', '#5a6638', '#62683d', '#3d4828'][Math.floor(r() * 4)]);
  }
  for (const [u, v, rr] of LAWNS) {
    blob(u, v, rr, '#6f8c42');
    for (let k = 0; k < 20; k++) blob(u + (r() - 0.5) * rr * 1.4, v + (r() - 0.5) * rr * 1.4, 2 + r() * 4, r() < 0.5 ? '#668438' : '#7a974a');
  }
  g.strokeStyle = '#c9bc9c';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const pl of PATHS) {
    g.lineWidth = 3 * K;
    g.beginPath();
    pl.forEach(([u, v], i) => (i ? g.lineTo(X(v), Y(u)) : g.moveTo(X(v), Y(u))));
    g.stroke();
  }
  // playground by the first lawn
  blob(4, 100, 6, '#a9564a');
  blob(4, 100, 3, '#d4c294');

  // streets: pavements, kerbs, asphalt, markings, crossings
  const street = (ew: boolean, at: number, from: number, to: number) => {
    if (ew) {
      rectUV(at - EDGE, at + EDGE, from, to, '#bdb8ad');
      rectUV(at - ROAD / 2 - 0.25, at + ROAD / 2 + 0.25, from, to, '#8f8c86');
      rectUV(at - ROAD / 2, at + ROAD / 2, from, to, '#4d4e51');
    } else {
      rectUV(from, to, at - EDGE, at + EDGE, '#bdb8ad');
      rectUV(from, to, at - ROAD / 2 - 0.25, at + ROAD / 2 + 0.25, '#8f8c86');
      rectUV(from, to, at - ROAD / 2, at + ROAD / 2, '#4d4e51');
    }
  };
  for (const s of ROADS_EW) street(true, s.at, s.from, s.to);
  for (const s of ROADS_NS) street(false, s.at, s.from, s.to);
  for (const s of ROADS_EW) for (let v = s.from; v < s.to; v += 9) rectUV(s.at - 0.07, s.at + 0.07, v, v + 4.5, '#e2e0d8');
  for (const s of ROADS_NS) for (let u = s.from; u < s.to; u += 9) rectUV(u, u + 4.5, s.at - 0.07, s.at + 0.07, '#e2e0d8');
  // parking bays along the park street
  for (let u = -256; u < 256; u += 5.5) for (const side of [-1, 1]) rectUV(u, u + 0.12, 60 + side * (ROAD / 2 - 2.2) - 1.1, 60 + side * (ROAD / 2 - 2.2) + 1.1, '#cfcdc6');
  // zebra crossings next to every crossing
  for (const a of ROADS_EW) {
    for (const b of ROADS_NS) {
      if (b.at < a.from || b.at > a.to) continue;
      for (let k = -ROAD / 2 + 0.4; k < ROAD / 2; k += 1) {
        rectUV(a.at + EDGE + 0.5, a.at + EDGE + 3.5, b.at + k, b.at + k + 0.5, '#e6e5de');
        rectUV(a.at + k, a.at + k + 0.5, b.at + EDGE + 0.5, b.at + EDGE + 3.5, '#e6e5de');
      }
    }
  }

  // the Ayalon: walls, lanes, the railway in its trench in the middle
  {
    const p = (v: number, d: number) => [X(v), Y(highwayU(v) + d / HIGHWAY.cos)] as const;
    const band = (d0: number, d1: number, fill: string) => {
      g.fillStyle = fill;
      g.beginPath();
      const q = [p(-GROUND_HALF, d0), p(GROUND_HALF, d0), p(GROUND_HALF, d1), p(-GROUND_HALF, d1)];
      q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fill();
    };
    band(-HIGHWAY.half, HIGHWAY.half, '#8a877f');
    band(-33, -17, '#4a4b4e');
    band(17, 33, '#4a4b4e');
    band(-13, 13, '#6a6157');
    for (const t of [-9, -4.5, 0, 4.5, 9]) band(t - 0.9, t + 0.9, '#47413a');
    for (const t of [-9, -4.5, 0, 4.5, 9]) for (const rr of [-0.72, 0.72]) band(t + rr - 0.06, t + rr + 0.06, '#bdbebd');
    for (const lane of [-29.5, -25.5, -21.5, 21.5, 25.5, 29.5]) band(lane - 0.08, lane + 0.08, 'rgba(230, 228, 220, 0.6)');
  }
  // round the pano towers' bases and the neighbour: their own plazas (a building site round the construction tower)
  for (const t of PANO_TOWERS) {
    const m = 500;
    poly([facePoint(t.m, t.d, t.s0 - m, -m), facePoint(t.m, t.d, t.s1 + m, -m), facePoint(t.m, t.d, t.s1 + m, t.depth + m), facePoint(t.m, t.d, t.s0 - m, t.depth + m)],
      t.name === 'construction' ? '#9a8a72' : '#b6b0a3');
  }
  poly(neighbourFootprint().map(([x, z], i, a) => {
    const [cx, cz] = [(a[0][0] + a[2][0]) / 2, (a[0][1] + a[2][1]) / 2];
    return [cx + (x - cx) * 1.3, cz + (z - cz) * 1.3] as [number, number];
  }), '#c2bbab');

  // soft shadows: buildings and trees throw them to the east-north-east (sun low in the west-south-west)
  const sh = dir(75);
  for (const b of plan.buildings) {
    const k = Math.min(b.h, 2500) * 0.9;
    const pts = b.fp;
    const s = pts.map(([x, z]) => [x + sh[0] * k, z + sh[1] * k] as [number, number]);
    const col = 'rgba(30, 32, 40, 0.3)';
    for (let i = 0; i < 4; i++) poly([pts[i], pts[(i + 1) % 4], s[(i + 1) % 4], s[i]], col);
    poly(s, col);
  }
  for (const t of plan.trees) {
    const [u, v] = toGrid(t.x + sh[0] * t.r * 1.2, t.z + sh[1] * t.r * 1.2);
    blob(u, v, (t.r / 100) * 1.05, 'rgba(25, 32, 20, 0.33)');
  }
  // grain: a little noise over everything (asphalt, paving, lawn)
  const img = g.getImageData(0, 0, N, N);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 20;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  return c;
}
