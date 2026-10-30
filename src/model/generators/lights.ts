import type { Part, Vec3 } from '../schema';
import { box, cyl, str } from './builtins';

const num = (v: unknown, d: number) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

// Decorative lamps (🕯️ Cozy + 💡 Work) - their emit role is 'decorative'; ceiling/task lights stay functional.

const ell = (id: string, tags: string[], size: Vec3, position: Vec3, color: string): Part => (
  { id, tags, geometry: { type: 'ellipsoid', size, segments: 18 }, position, rotation: [0, 0, 0], color, castShadow: false, glass: false }
);

/**
 * LED strip in a slim aluminium channel with a diffuser, mounted under a shelf: the item's origin is the top-back-centre
 * of the channel (so position y = the shelf's underside). Lights up (glow + soft downward light) when the room light is on.
 * Params: length, axis (x | z, the direction the strip runs), color (light colour), intensity.
 */
export function ledStrip(params: Record<string, unknown>): Part[] {
  const L = num(params.length, 60);
  const along = params.axis === 'z' ? 'z' : 'x';
  const color = String(params.color ?? '#fff1dc');
  const size = (l: number, h: number, w: number): Vec3 => (along === 'x' ? [l, h, w] : [w, h, l]);
  const pos = (y: number, d: number): Vec3 => (along === 'x' ? [0, y, d] : [d, y, 0]);
  return [
    { id: 'channel', tags: ['led', 'channel'], geometry: { type: 'box', size: size(L, 0.8, 1.8) }, position: pos(-0.4, 0.9), rotation: [0, 0, 0], material: 'aluminium-grey', castShadow: false, glass: false },
    {
      id: 'diffuser', tags: ['led', 'light'], geometry: { type: 'box', size: size(L - 0.4, 0.3, 1.2) }, position: pos(-0.95, 0.9), rotation: [0, 0, 0],
      color: '#f4f4f2', castShadow: false, glass: false,
      emit: { color, intensity: num(params.intensity, 6), kind: 'area', role: params.role === 'decorative' ? 'decorative' : 'functional' },
    },
  ];
}

/**
 * Small table lamp (cozy corner light, ~25 W warm): a mushroom (IKEA LAMPAN/"Panthella mini"-like), a globe on a
 * stem, or a fabric drum. Origin = bottom-centre on the surface it stands on (+z the front, which is just symmetric).
 * Params: shape (mushroom | globe | drum), height, diameter, color (shade), baseColor, intensity.
 */
export function tableLamp(params: Record<string, unknown>): Part[] {
  const shape = str(params.shape, 'mushroom');
  const H = num(params.height, 32);
  const d = num(params.diameter, 24);
  const shade = str(params.color, '#f3ebdc');
  const base = str(params.baseColor, '#c49c68');
  const emit = { color: '#ffcf96', intensity: num(params.intensity, 2500), kind: 'point' as const, role: 'decorative' as const };
  const glow = (p: Part): Part => ({ ...p, castShadow: false, emit });
  if (shape === 'drum') {
    return [
      cyl('base', ['base'], 6, 2, [0, 1, 0], { color: base }),
      cyl('stem', ['stem'], 0.8, H * 0.55, [0, 2 + H * 0.275, 0], { color: base }),
      glow(cyl('shade', ['shade'], d / 2, H * 0.45, [0, H - H * 0.225, 0], { color: shade, material: 'linen-white' })),
    ];
  }
  if (shape === 'globe') {
    return [
      cyl('base', ['base'], 7, 3, [0, 1.5, 0], { color: base }),
      glow(ell('shade', ['shade'], [d, d, d], [0, 3 + d / 2, 0], shade)),
    ];
  }
  // mushroom: a wide dome on a slim stem, light coming out underneath
  return [
    cyl('base', ['base'], d * 0.32, 1.5, [0, 0.75, 0], { color: shade }),
    cyl('stem', ['stem'], d * 0.1, H - d * 0.25, [0, (H - d * 0.25) / 2, 0], { color: shade }),
    glow(ell('shade', ['shade'], [d, d * 0.5, d], [0, H - d * 0.25, 0], shade)),
  ];
}

/**
 * Warm string lights ("festoon" / fairy lights) hanging in a shallow sag between two points along local x.
 * Origin = the left end; the string runs to x = length and sags `sag` cm in the middle. Bulbs only glow; one
 * light in the middle does the lighting. Params: length, sag, bulbs, bulbSize, color (light), intensity.
 */
export function stringLights(params: Record<string, unknown>): Part[] {
  const L = num(params.length, 300);
  const sag = num(params.sag, 15);
  const n = Math.max(2, Math.round(num(params.bulbs, Math.round(L / 30))));
  const r = num(params.bulbSize, 3);
  const color = str(params.color, '#ffc98a');
  const y = (x: number) => -sag * 4 * (x / L) * (1 - x / L);
  const parts: Part[] = [];
  // the cord as short straight pieces following the sag
  const seg = 8;
  for (let i = 0; i < seg; i++) {
    const [x0, x1] = [(L * i) / seg, (L * (i + 1)) / seg];
    const [y0, y1] = [y(x0), y(x1)];
    const len = Math.hypot(x1 - x0, y1 - y0);
    parts.push({ ...box(`cord-${i}`, ['cord'], [len, 0.4, 0.4], [(x0 + x1) / 2, (y0 + y1) / 2, 0], { color: '#1d1d1f', castShadow: false }), rotation: [0, 0, (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI] });
  }
  for (let i = 0; i < n; i++) {
    const x = (L * (i + 0.5)) / n;
    const mid = i === Math.floor(n / 2);
    parts.push({ ...ell(`bulb-${i}`, ['bulb', 'light'], [r * 2, r * 2.6, r * 2], [x, y(x) - 2 - r, 0], '#fff4e0'),
      emit: { color, intensity: mid ? num(params.intensity, 6000) : 0, kind: mid ? 'point' : 'glow', role: 'decorative' } });
  }
  return parts;
}

/**
 * Pillar candles (decoration only: never lit, Mark). Origin = bottom-centre on the surface. Params: count (1-3),
 * color, tray (true = on a round tray).
 */
export function candles(params: Record<string, unknown>): Part[] {
  const count = Math.min(3, Math.max(1, Math.round(num(params.count, 3))));
  const color = str(params.color, '#f4eee2');
  const tray = params.tray !== false;
  const lift = tray ? 1.2 : 0;
  const sizes: [number, number, number][] = [[-7, 15, 3.6], [3, 10, 3.6], [9, 7, 3]];
  const parts: Part[] = [];
  if (tray) parts.push(cyl('tray', ['tray'], 14, 1.2, [0, 0.6, 0], { color: '#b08a5a', material: 'wood-oak-light' }));
  sizes.slice(0, count).forEach(([x, h, r], i) => {
    parts.push(cyl(`candle-${i}`, ['candle'], r, h, [x, lift + h / 2, i === 1 ? 3 : -1], { color }));
    parts.push(cyl(`wick-${i}`, ['wick'], 0.15, 1, [x, lift + h + 0.5, i === 1 ? 3 : -1], { color: '#2a2a2a', castShadow: false }));
  });
  return parts;
}

/**
 * Outdoor wall light (IP44 up/down cylinder), functional. Origin = back-centre on the wall at the fixture's bottom.
 * Params: color (body), intensity.
 */
export function wallLantern(params: Record<string, unknown>): Part[] {
  const body = str(params.color, '#2b2b2b');
  return [
    box('plate', ['plate'], [7, 7, 1], [0, 9, 0.5], { color: body }),
    cyl('body', ['body'], 4.5, 16, [0, 8, 6], { color: body }),
    { ...cyl('lens', ['light'], 3.8, 0.6, [0, -0.3, 6], { color: '#fff6e8', castShadow: false }),
      emit: { color: '#ffdcae', intensity: num(params.intensity, 9000), kind: 'point' } },
  ];
}

/**
 * Round surface-mounted LED ceiling light ("flush mount"), e.g. Ø30 cm / 24 W / ~2000+ lm. Origin = top-centre, so
 * position y = the ceiling or shelf underside it is screwed to. Params: diameter, height, color, intensity.
 */
export function surfaceLight(params: Record<string, unknown>): Part[] {
  const d = num(params.diameter, 30);
  const h = num(params.height, 6);
  const color = String(params.color ?? '#fff6e8');
  return [
    { id: 'housing', tags: ['lamp', 'housing'], geometry: { type: 'cylinder', radius: d / 2, height: h - 1, segments: 32 }, position: [0, -(h - 1) / 2, 0], rotation: [0, 0, 0], color: '#f4f4f2', castShadow: false, glass: false },
    {
      id: 'diffuser', tags: ['lamp', 'light'], geometry: { type: 'cylinder', radius: d / 2 - 1, height: 1, segments: 32 }, position: [0, -h + 0.5, 0], rotation: [0, 0, 0],
      color: '#fbfbf8', castShadow: false, glass: false, emit: { color, intensity: num(params.intensity, 14000), kind: 'point' },
    },
  ];
}
