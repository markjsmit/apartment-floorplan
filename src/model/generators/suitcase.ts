import type { Part, Vec3 } from '../schema';

const num = (v: unknown, d: number) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

/**
 * Hard-shell trolley suitcase lying flat (for storage). Params: length (x, wheels at +x end), width (z), thickness (y), color.
 * Item convention: origin back-centre on the surface it lies on.
 */
export function suitcase(params: Record<string, unknown>): Part[] {
  const L = num(params.length, 78);
  const W = num(params.width, 52);
  const T = num(params.thickness, 31);
  const color = String(params.color ?? '#2f4a6d');
  const box = (id: string, tags: string[], size: Vec3, position: Vec3, c = color): Part => ({
    id, tags, geometry: { type: 'box', size }, position, rotation: [0, 0, 0], color: c, castShadow: true, glass: false,
  });
  const wheelR = 2.5;
  const shell = L - 2 * wheelR; // wheels stick out of the bottom end
  const parts: Part[] = [
    box('shell-bottom', ['shell'], [shell, T / 2 - 0.5, W], [-wheelR, (T / 2 - 0.5) / 2, W / 2]),
    box('shell-top', ['shell'], [shell, T / 2 - 0.5, W], [-wheelR, T - (T / 2 - 0.5) / 2, W / 2]),
    box('zip', ['zip'], [shell - 0.4, 1, W - 0.4], [-wheelR, T / 2, W / 2], '#1b1b1d'),
    // carry handle on the long front side, trolley handle housing at the top end
    box('handle', ['handle'], [16, 2.5, 2], [-wheelR, T / 2, W + 1], '#1b1b1d'),
    box('trolley', ['handle', 'trolley'], [2, T * 0.6, W * 0.5], [-L / 2 + wheelR + 1, T / 2, W / 2], '#1b1b1d'),
  ];
  for (const [i, z] of [W * 0.15, W * 0.85].entries()) {
    for (const [j, y] of [T * 0.2, T * 0.8].entries()) {
      parts.push({
        id: `wheel-${i}${j}`, tags: ['wheel'], geometry: { type: 'cylinder', radius: wheelR, height: 2, segments: 16 },
        position: [L / 2 - wheelR, y, z], rotation: [0, 0, 0], color: '#1b1b1d', castShadow: true, glass: false,
      });
    }
  }
  return parts;
}
