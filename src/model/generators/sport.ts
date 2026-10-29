import { Euler, Quaternion, Vector3 } from 'three';
import type { Geometry, Part, Vec2, Vec3 } from '../schema';
import { rng } from './stuff';
import { COAT_COLORS, coat } from './wear';

// Sports gear for the skating corner: soft backpacks, triangular skate bags on a hook rail, figure / hockey skates.
// Fabric is built from ellipsoids (soft, a bit lumpy, varied by `seed`) instead of boxes.
// Item convention: origin back-centre on the surface it stands on, +z out of the front.

const num = (v: unknown, d: number) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const DARK = '#232326';
const FABRIC = 'nylon-fabric'; // tinted by the part colour
const LEATHER = 'leather-smooth';

const part = (id: string, tags: string[], geometry: Geometry, position: Vec3, rotation: Vec3 = [0, 0, 0], color?: string, material?: string): Part => ({
  id, tags, geometry, position, rotation, castShadow: true, glass: false, ...(color ? { color } : {}), ...(material ? { material } : {}),
});
const ell = (id: string, tags: string[], size: Vec3, position: Vec3, rotation: Vec3, color: string, material: string | undefined = FABRIC) =>
  part(id, tags, { type: 'ellipsoid', size, segments: 14 }, position, rotation, color, material);
const box = (id: string, tags: string[], size: Vec3, position: Vec3, rotation: Vec3, color: string, material?: string) =>
  part(id, tags, { type: 'box', size }, position, rotation, color, material);

const DEG = Math.PI / 180;
/** Turn a group of parts by `rotation` (degrees, about the item origin) and then move it by `move`. */
function turn(parts: Part[], rotation: Vec3, move: Vec3 = [0, 0, 0]): Part[] {
  const q = new Quaternion().setFromEuler(new Euler(rotation[0] * DEG, rotation[1] * DEG, rotation[2] * DEG));
  return parts.map((p) => {
    const pos = new Vector3(...p.position).applyQuaternion(q).add(new Vector3(...move));
    const e = new Euler().setFromQuaternion(q.clone().multiply(new Quaternion().setFromEuler(new Euler(p.rotation[0] * DEG, p.rotation[1] * DEG, p.rotation[2] * DEG))));
    return { ...p, position: [pos.x, pos.y, pos.z], rotation: [e.x / DEG, e.y / DEG, e.z / DEG] };
  });
}

// Rounded rectangle w x h around (0, 0): bottom corners radius rb, top corners rt (a backpack's top is round).
function roundedRect(w: number, h: number, rb: number, rt: number): Vec2[] {
  const out: Vec2[] = [];
  const arc = (cx: number, cy: number, r: number, from: number) => {
    for (let k = 0; k <= 4; k++) { const a = ((from + k * 22.5) * Math.PI) / 180; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  };
  arc(w / 2 - rb, -h / 2 + rb, rb, -90);
  arc(w / 2 - rt, h / 2 - rt, rt, 0);
  arc(-w / 2 + rt, h / 2 - rt, rt, 90);
  arc(-w / 2 + rb, -h / 2 + rb, rb, 180);
  return out;
}

/** Soft padded panel: a rounded outline w x h, `depth` thick (centred on z), edges rounded by `soft` cm. */
const pad = (id: string, tags: string[], w: number, h: number, depth: number, soft: number, rb: number, rt: number, position: Vec3, rotation: Vec3, color: string) =>
  part(id, tags, { type: 'prism', points: roundedRect(w - 2 * soft, h - 2 * soft, Math.max(0.5, rb - soft), Math.max(0.5, rt - soft)), depth, bevel: soft }, position, rotation, color, FABRIC);

/**
 * Soft backpack / gym bag (padded fabric shapes, a bit different per `seed`). Params: color, accent, seed, pose:
 * - slumped: standing, sagging and leaning back against the wall, a shoulder strap flopped out to the side
 * - lying: dropped flat on its back, top towards +x, straps spread out (inward: top towards -z, into a shelf;
 *   slope: tilted front-down by that many degrees, e.g. on a shoe rack's tubes)
 * - stuffed: pushed into a Kallax cube (fills ~31 x 28 x 36), pocket bulging out and a strap hanging out of the front
 */
export function backpack(params: Record<string, unknown>): Part[] {
  const color = String(params.color ?? '#3b3f46');
  const accent = String(params.accent ?? DARK);
  const pose = String(params.pose ?? 'slumped');
  const flap = params.flap ? String(params.flap) : null; // a lid / top panel in another colour
  const rand = rng(String(params.seed ?? 'backpack'));
  const j = (amount: number) => (rand() - 0.5) * 2 * amount; // jitter ±amount
  const tags = ['bag', 'backpack'];
  const strap = (id: string, size: Vec3, position: Vec3, rotation: Vec3) => box(id, [...tags, 'strap'], size, position, rotation, accent, FABRIC);

  if (pose === 'lying') {
    // outline in x/y, then turned flat: outline +y (the top) → +x, thickness → up
    const L = 44 + j(2), W = 30 + j(2), T = 13 + j(2);
    const flat: Vec3 = [-90, 0, -90];
    const parts = [
      pad('body', tags, W, L, T, 4.5, 6, 13, [0, T / 2, W / 2], flat, color),
      ...(flap ? [pad('flap', [...tags, 'flap'], W + 1, L * 0.42, 4, 1.8, 5, 13, [L * 0.26, T - 0.8, W / 2], [-90 + j(3), 0, -90], flap)] : []),
      pad('pocket', [...tags, 'pocket'], W * 0.7, L * 0.42, 5, 2.2, 4, 5, [-L * 0.16, T + 1.5, W / 2 + j(1.5)], flat, color),
      box('zip', [...tags, 'zip'], [L * 0.7, 0.6, 1.2], [L * 0.05, T - 0.3, W / 2 - W * 0.36], [0, j(3), 0], DARK),
      strap('handle', [7, 1.2, 3], [L / 2 + 1.5, T * 0.55, W / 2], [0, 0, 25]),
      strap('strap-1', [28, 0.8, 4.5], [j(3), 0.5, W - 2], [0, 18 + j(10), 0]),
      strap('strap-2', [24, 0.8, 4.5], [j(3) + 3, 0.5, 3], [0, -14 + j(10), 0]),
    ];
    // inward: turned so its top points into the shelf (e.g. pushed under a bench); slope: front-down degrees
    const inward = params.inward ? turn(parts, [0, 90, 0], [-W / 2, 0, L / 2]) : parts;
    const slope = num(params.slope, 0);
    return slope ? turn(inward, [slope, 0, 0]) : inward;
  }

  if (pose === 'stuffed') {
    const W = 31 + j(1), H = 28 + j(1.5), D = 34 + j(1);
    return [
      pad('body', tags, W, H, D, 5, 5, 7, [j(0.8), H / 2, D / 2], [0, j(3), j(2)], color),
      pad('pocket', [...tags, 'pocket'], W * 0.66, H * 0.5, 5, 2.2, 3, 4, [j(2), H * 0.36, D + 1.2], [0, 0, j(6)], color),
      box('zip', [...tags, 'zip'], [W * 0.75, 0.6, 1.2], [j(1), H - 0.6, D * 0.6], [0, j(4), j(2)], DARK),
      strap('handle', [10, 3, 1.2], [j(3), H * 0.8, D + 0.4], [0, 0, j(12)]),
      strap('strap-out', [4.5, 22, 0.8], [W * 0.28 + j(2), H * 0.28, D + 1], [10 + j(6), 0, 12 + j(12)]),
    ];
  }

  // slumped against the wall: padded body leaning back, pocket on the front, a shoulder strap flopped out
  const W = 30 + j(1.5), H = 43 + j(2), D = 16 + j(2);
  const lean = -8 + j(3), tilt = j(5);
  return [
    pad('body', tags, W, H, D, 5, 6, 13, [j(1), H / 2 - 0.5, D / 2 + 1], [lean, j(5), tilt], color),
    ell('sag', tags, [W * 1.04, 11, D * 1.12], [0, 5.5, D / 2 + 1.5], [0, 0, tilt / 2], color),
    pad('pocket', [...tags, 'pocket'], W * 0.7, H * 0.38, 5, 2.2, 4, 6, [j(1), H * 0.27, D + 2.5], [lean, 0, tilt + j(4)], color),
    box('zip', [...tags, 'zip'], [W * 0.62, 0.6, 1.2], [0, H - 3.5, D / 2 + 3], [lean - 30, 0, tilt], DARK),
    strap('handle', [7, 3, 1.2], [j(1), H + 0.5, D / 2], [0, 0, j(15)]),
    strap('strap-flop', [4.5, 30, 0.8], [W / 2 + 5, 9, D / 2 + 3], [0, 0, 62 + j(12)]),
  ];
}

// Skate bag side view: the skates inside are an L (boot up at the heel, blade along the bottom), so the bag is a
// right-ish triangle: flat bottom b long, upright back at the heel h high, sloping front down to the toe. Corners
// rounded with radius r. Points around (0, 0), heel at -x.
function skateBagOutline(b: number, h: number, r: number): Vec2[] {
  const corners: Vec2[] = [[-b / 2, -h / 2], [b / 2, -h / 2], [-b / 2 + 7, h / 2]];
  const out: Vec2[] = [];
  corners.forEach((c, i) => {
    const prev = corners[(i + 2) % 3], next = corners[(i + 1) % 3];
    const toward = (p: Vec2): Vec2 => {
      const dx = p[0] - c[0], dy = p[1] - c[1], len = Math.hypot(dx, dy);
      return [c[0] + (dx / len) * r * 1.4, c[1] + (dy / len) * r * 1.4];
    };
    const a = toward(prev), z = toward(next);
    for (let t = 0; t <= 4; t++) { // quadratic curve a → c → z
      const u = t / 4;
      out.push([(1 - u) ** 2 * a[0] + 2 * (1 - u) * u * c[0] + u ** 2 * z[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * c[1] + u ** 2 * z[1]]);
    }
  });
  return out;
}

/** Skate bag for one pair, hanging by the handle on its top corner (over the heels) from a hook at (x, hookY, hookZ). */
function skateBag(id: string, x: number, hookY: number, hookZ: number, color: string): Part[] {
  const b = 40, h = 34, w = 22, bevel = 2.5; // Decathlon / Graf type: ~40 long, ~35 high at the heel, ~22-24 wide
  const cx = x + b / 2 - 9; // top corner (heel side) right under the hook
  const cy = hookY - 6 - h / 2;
  const cz = w / 2 + 2.2;
    const ib = b - 2 * bevel, ih = h - 2 * bevel; // the outline; the bevel puts the fabric surface `bevel` further out
  const th = Math.atan2(ih, ib - 7); // the sloping front, from the top corner down to the toe
  const slope = (th * 180) / Math.PI;
  const out = bevel + 0.2;
  const zipX = cx + 3.5 + out * Math.sin(th), zipY = cy + out * Math.cos(th);
  const tags = ['bag', 'skate bag'];
  return [
    part(id, tags, { type: 'prism', points: skateBagOutline(b - 2 * bevel, h - 2 * bevel, 4), depth: w, bevel }, [cx, cy, cz], [0, 0, 0], color, FABRIC),
    // the sides bulge a little (skates inside); zip down the middle of the sloping front, a small mesh vent on the
    // side, fabric handle up to the hook
    ell(`${id}-bulge`, tags, [b * 0.5, h * 0.45, 3], [cx - 3, cy - h * 0.15, cz + w / 2 - 1.2], [0, 0, 0], color),
    box(`${id}-zip`, [...tags, 'zip'], [Math.hypot(ib - 7, ih) - 4, 0.6, 1.4], [zipX, zipY, cz], [0, 0, -slope], DARK),
    box(`${id}-vent`, [...tags, 'vent'], [9, 5, 0.4], [cx - 9, cy - h * 0.3, cz + w / 2 + 0.4], [0, 0, 0], '#3a3b3f', FABRIC),
    box(`${id}-handle`, [...tags, 'strap'], [3, 8, 0.8], [x, hookY - 2.5, hookZ], [0, 0, 0], DARK, FABRIC),
  ];
}

/**
 * One skate bag standing on a surface (origin back-centre at the bottom), its long side along x. Params: color,
 * flip (heel side at +x instead of -x).
 */
export function skateBagItem(params: Record<string, unknown>): Part[] {
  const parts = skateBag('bag', -11, 40, 13.2, String(params.color ?? '#b3202a'));
  if (!params.flip) return parts;
  return parts.map((p) => ({
    ...p,
    position: [-p.position[0], p.position[1], p.position[2]],
    rotation: [p.rotation[0], -p.rotation[1], -p.rotation[2]],
    geometry: p.geometry?.type === 'prism' ? { ...p.geometry, points: p.geometry.points.map(([x, y]) => [-x, y] as Vec2).reverse() } : p.geometry,
  }));
}

/**
 * Wall rail with hooks and skate bags. Params: width (rail), hooks, bags (how many on the hooks, from both ends),
 * bagColor. Origin back-centre at the bottom of the rail (place it with against.elevation).
 */
export function hookRail(params: Record<string, unknown>) {
  const W = num(params.width, 70);
  const n = Math.max(1, Math.round(num(params.hooks, 3)));
  const bagCount = Math.round(num(params.bags, 2));
  const bagColor = String(params.bagColor ?? '#b3202a');
  const parts: Part[] = [part('rail', ['rail'], { type: 'box', size: [W, 9, 2] }, [0, 4.5, 1], [0, 0, 0], undefined, 'wood-oak-light')];
  const xs = Array.from({ length: n }, (_, i) => (n === 1 ? 0 : -W / 2 + 8 + (i * (W - 16)) / (n - 1)));
  xs.forEach((x, i) => {
    parts.push(box(`hook-${i + 1}`, ['hook'], [1.2, 1.2, 6], [x, 5, 5], [0, 0, 0], DARK, 'metal-black'));
    parts.push(box(`hook-${i + 1}-tip`, ['hook'], [1.2, 4, 1.2], [x, 6.4, 7.4], [0, 0, 0], DARK, 'metal-black'));
  });
  const onHooks = [xs[0], xs[n - 1], ...xs.slice(1, -1)].slice(0, bagCount);
  const bagParts = onHooks.flatMap((x, i) => skateBag(`bag-${i + 1}`, x, 7, 7.4, bagColor));
  parts.push(...bagParts);
  // jackets on the hooks the bags leave free
  const coatColors = String(params.coatColors ?? '').split(',').map((c) => c.trim()).filter(Boolean);
  xs.filter((x) => !onHooks.includes(x)).slice(0, Math.round(num(params.coats, 0))).forEach((x, i) =>
    parts.push(...coat(`coat-${i + 1}`, x, 7, 9, coatColors[i % Math.max(coatColors.length, 1)] ?? COAT_COLORS[i % COAT_COLORS.length], false, num(params.coatLength, 72))));
  const hidden = Object.fromEntries(bagParts.map((p) => [p.id, { visible: false }]));
  return {
    parts,
    states: [{ id: 'bags', name: 'Bags on the hooks', parts: {} }, { id: 'empty', name: 'Empty hooks', parts: hidden }],
    interactions: onHooks.map((_, i) => ({ part: `bag-${i + 1}`, action: 'cycleStates' as const })),
  };
}

/**
 * A pair of ice skates, toes towards +z. Params: kind = figure (white boots, silver blade with toe pick, heel block) |
 * hockey (black boots, red accents, plastic blade holder, tendon guard), seed (each skate a bit skewed), pose =
 * standing (side by side, ~20 wide) | lying (each on its side, blades together in the middle, boots out: ~56 wide,
 * ~10 high; `slope` degrees front-down, e.g. on a shoe rack's sloped tubes).
 */
export function iceSkates(params: Record<string, unknown>): Part[] {
  const hockey = String(params.kind ?? 'figure') === 'hockey';
  const rand = rng(String(params.seed ?? 'skates'));
  const j = (a: number) => (rand() - 0.5) * 2 * a;
  const lying = String(params.pose ?? 'standing') === 'lying';
  const slope = num(params.slope, 0);
  const parts: Part[] = [];
  const boot = hockey ? '#1c1c1f' : '#f2f0ec';
  const accent = hockey ? '#c0262d' : '#d9d6cf';
  for (const [s, side] of [['l', -1], ['r', 1]] as const) {
    const start = parts.length;
    const x = lying ? 0 : side * 5.3 + j(0.8), yaw = j(7), L = 28;
    const t = (z: number): Vec3 => [x + Math.sin((yaw * Math.PI) / 180) * (z - L / 2), 0, z]; // along the skate
    const at = (z: number, y: number): Vec3 => { const p = t(z); return [p[0], y, p[2]]; };
    const r: Vec3 = [0, yaw, 0];
    const tags = ['skate', hockey ? 'hockey skate' : 'figure skate'];
    if (hockey) {
      parts.push(box(`${s}-steel`, [...tags, 'blade'], [0.4, 1.6, 27], at(L / 2, 0.8), r, '#c9ced3'));
      parts.push(box(`${s}-holder`, [...tags, 'holder'], [1.6, 4.5, 26], at(L / 2, 3.8), r, '#2a2a2d'));
      parts.push(ell(`${s}-foot`, [...tags, 'boot'], [9, 9, 27], at(L / 2, 10), r, boot, LEATHER));
      parts.push(ell(`${s}-ankle`, [...tags, 'boot'], [9.5, 13, 13], at(7, 16.5), r, boot, LEATHER));
      parts.push(box(`${s}-tendon`, [...tags, 'tendon guard'], [5, 8, 1.5], at(1, 25), [12, yaw, 0], accent));
      parts.push(box(`${s}-stripe`, [...tags, 'accent'], [9.6, 1.5, 14], at(11, 12), r, accent));
      parts.push(box(`${s}-tongue`, [...tags, 'tongue'], [5, 11, 1.5], at(13, 20), [-20, yaw, 0], accent));
    } else {
      parts.push(box(`${s}-blade`, [...tags, 'blade'], [0.4, 3.6, 29], at(L / 2 + 0.5, 1.8), r, '#c9ced3'));
      parts.push(box(`${s}-pick`, [...tags, 'blade', 'toe pick'], [0.5, 2.5, 2.5], at(L + 0.5, 4), [35, yaw, 0], '#c9ced3'));
      parts.push(box(`${s}-heel`, [...tags, 'heel'], [6, 3.5, 6], at(3.5, 5.3), r, '#8a5a32'));
      parts.push(box(`${s}-sole`, [...tags, 'sole'], [8, 0.8, 26], at(L / 2 + 0.5, 7.4), r, DARK));
      parts.push(ell(`${s}-foot`, [...tags, 'boot'], [8.6, 9, 27], at(L / 2, 11.5), r, boot, LEATHER));
      parts.push(ell(`${s}-ankle`, [...tags, 'boot'], [8.8, 17, 12], at(6.5, 20), r, boot, LEATHER));
      parts.push(box(`${s}-laces`, [...tags, 'laces'], [2.6, 15, 0.6], at(11.5, 19), [-14, yaw, 0], accent));
    }
    // lying: tip the skate onto its side, boot outwards (left skate to -x), resting on the boot's side (~4.5 cm)
    if (lying) parts.splice(start, parts.length - start, ...turn(parts.slice(start), [0, 0, -side * 90], [side * 0.5, 4.6, 0]));
  }
  return slope ? turn(parts, [slope, 0, 0]) : parts;
}
