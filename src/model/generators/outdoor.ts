import type { Part } from '../schema';
import { box as sharpBox, cyl, num, str, type Extra } from './builtins';
import type { Vec3 } from '../schema';

// Balcony furniture: our grey rattan set from the old house (loveseat, armchairs, glass-top coffee table) and a bar
// counter that sits on the glass railing's handrail. Low detail on purpose; item convention: origin back-centre on
// the floor, +z out of the front.

function box(id: string, tags: string[], size: Vec3, position: Vec3, extra: Extra & { radius?: number } = {}): Part {
  const { radius, ...rest } = extra;
  const b = sharpBox(id, tags, size, position, rest);
  const r = radius ?? Math.min(1, Math.min(...size) * 0.3);
  return r > 0.05 && b.geometry?.type === 'box' ? { ...b, geometry: { ...b.geometry, radius: r } } : b;
}

// grey resin wicker; frameColor (optional) tints it
const rattan = (p: Record<string, unknown>): Extra => (typeof p.frameColor === 'string' && p.frameColor ? { material: 'rattan-grey', color: p.frameColor } : { material: 'rattan-grey' });

/**
 * Rattan seat (armchair or loveseat). params: width, depth, seatHeight (top of the cushion), backHeight, armHeight,
 * frameColor (tint on rattan-grey), cushionColor, pillows (comma-separated colours of loose back pillows).
 */
export function rattanSeat(p: Record<string, unknown>): Part[] {
  const W = num(p.width, 62);
  const D = num(p.depth, 64);
  const SH = num(p.seatHeight, 44);
  const BH = num(p.backHeight, 84);
  const AH = num(p.armHeight, 64);
  const frame = rattan(p);
  const cushion: Extra = { material: 'linen-white', color: str(p.cushionColor, '#e8e2d6') };
  const ct = 7; // cushion thickness
  const sy = SH - ct; // top of the seat frame
  const parts: Part[] = [];
  const lx = W / 2 - 3;
  for (const [i, x, z] of [[1, -lx, 4], [2, lx, 4], [3, -lx, D - 4], [4, lx, D - 4]] as const) {
    parts.push(cyl(`leg-${i}`, ['leg', 'frame'], 1.8, sy - 2, [x, (sy - 2) / 2, z], frame));
  }
  parts.push(box('seat-frame', ['frame', 'seat'], [W - 4, 5, D - 6], [0, sy - 2.5, D / 2], { ...frame, radius: 1.5 }));
  parts.push(box('apron', ['frame'], [W - 4, 8, 3], [0, sy - 6, D - 2.5], { ...frame, radius: 1.2 }));
  // arms: a padded rail on a woven side panel, curving down to the front leg
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - 2.5);
    const side = s < 0 ? 'l' : 'r';
    parts.push(box(`arm-${side}`, ['arm', 'frame'], [5, 5, D - 4], [x, AH - 2.5, D / 2 + 1], { ...frame, radius: 2.2 }));
    parts.push(box(`arm-panel-${side}`, ['arm', 'frame'], [2.5, AH - sy - 4, D - 14], [x, (AH + sy) / 2 - 2, D / 2 - 1], frame));
    parts.push(box(`arm-front-${side}`, ['arm', 'frame'], [5, AH - sy + 4, 5], [x, (AH + sy) / 2 - 2, D - 3.5], { ...frame, radius: 2.2 }));
  }
  // back: woven panel leaning back ~10°, with a rounded top rail
  const bh = BH - sy;
  parts.push({ ...box('back', ['back', 'frame'], [W - 6, bh, 3], [0, sy + bh / 2, 5], frame), rotation: [-10, 0, 0] });
  parts.push({ ...box('back-rail', ['back', 'frame'], [W - 4, 5, 5], [0, BH - 2, 5 - Math.sin((10 * Math.PI) / 180) * bh / 2], { ...frame, radius: 2.2 }), rotation: [-10, 0, 0] });
  parts.push(box('cushion', ['cushion', 'seat'], [W - 9, ct, D - 13], [0, SH - ct / 2, D / 2 + 2.5], { ...cushion, radius: 3 }));
  const pillows = str(p.pillows, '').split(',').map((c) => c.trim()).filter(Boolean);
  const pw = Math.min(42, (W - 14) / Math.max(1, pillows.length));
  pillows.forEach((c, i) => {
    const x = (i - (pillows.length - 1) / 2) * (pw + 2);
    parts.push({ ...box(`pillow-${i + 1}`, ['pillow', 'cushion'], [pw, 38, 13], [x, SH + 18, 15], { material: 'linen-white', color: c, radius: 5 }), rotation: [-12, 0, 0] });
  });
  return parts;
}

/** Rattan coffee table with a dark glass inset. params: width, depth, height, frameColor. */
export function rattanTable(p: Record<string, unknown>): Part[] {
  const W = num(p.width, 82);
  const D = num(p.depth, 44);
  const H = num(p.height, 40);
  const frame = rattan(p);
  const parts: Part[] = [];
  parts.push(box('top-frame', ['top', 'frame'], [W, 4, D], [0, H - 2, D / 2], { ...frame, radius: 1.5 }));
  parts.push(box('glass', ['top', 'glass'], [W - 16, 0.6, D - 14], [0, H + 0.1, D / 2], { material: 'glass-black', radius: 0 }));
  const lx = W / 2 - 9;
  const lz = D / 2 - 6;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
    // legs splay out a little towards the floor, like the photo
    parts.push({ ...cyl(`leg-${i + 1}`, ['leg', 'frame'], 2, H - 3, [sx * (lx + 2), (H - 3) / 2, D / 2 + sz * lz], frame), rotation: [sz * -5, 0, sx * 6] });
  });
  parts.push(box('stretcher', ['frame'], [W - 22, 3, 3], [0, 9, D / 2], frame));
  for (const sx of [-1, 1]) parts.push(box(`stretcher-${sx < 0 ? 'l' : 'r'}`, ['frame'], [3, 3, D - 14], [sx * (lx + 1), 9, D / 2], frame));
  return parts;
}

/**
 * Bar counter that rests on the railing's handrail and cantilevers into the balcony on black steel brackets clamped to
 * the rail. params: length, depth, height (counter top surface), thickness, railHeight (top of the handrail), material, color.
 */
export function railingBar(p: Record<string, unknown>): Part[] {
  const L = num(p.length, 300);
  const D = num(p.depth, 40);
  const H = num(p.height, 113);
  const T = num(p.thickness, 3);
  const rail = num(p.railHeight, H - T);
  const topLook: Extra = { material: str(p.material, 'wood-oak-light') };
  if (typeof p.color === 'string' && p.color) topLook.color = p.color;
  const steel: Extra = { material: 'metal-black' };
  const parts: Part[] = [box('top', ['top', 'counter', 'bar'], [L, T, D], [0, H - T / 2, D / 2], { ...topLook, radius: 0.8 })];
  const n = Math.max(2, Math.ceil(L / 90) + 1);
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + 8 + (i * (L - 16)) / (n - 1);
    // clamp over the handrail, a drop on the room side of it and a diagonal strut out to the front edge
    const drop = 26;
    parts.push(box(`clamp-${i + 1}`, ['bracket'], [4, 1, 7], [x, rail - 0.5, 3.5], { ...steel, radius: 0.3 }));
    parts.push(box(`drop-${i + 1}`, ['bracket'], [4, drop, 1], [x, rail - drop / 2, 7], { ...steel, radius: 0.3 }));
    const dz = D - 12;
    const dy = drop - 3;
    const len = Math.hypot(dz, dy);
    parts.push({ ...box(`strut-${i + 1}`, ['bracket'], [3, 1, len], [x, rail - 3 - dy / 2, 7 + dz / 2], { ...steel, radius: 0.3 }), rotation: [(-Math.atan2(dy, dz) * 180) / Math.PI, 0, 0] });
    parts.push(box(`arm-${i + 1}`, ['bracket'], [4, 1, D - 10], [x, rail - 0.5, 7 + (D - 10) / 2], { ...steel, radius: 0.3 }));
  }
  return parts;
}
