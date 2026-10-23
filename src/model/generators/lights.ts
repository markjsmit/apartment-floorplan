import type { Part, Vec3 } from '../schema';

const num = (v: unknown, d: number) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

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
      color: '#f4f4f2', castShadow: false, glass: false, emit: { color, intensity: num(params.intensity, 6) },
    },
  ];
}
