import type { Part, PartOverride, Vec3 } from '../schema';
import type { Generated } from './index';

// IKEA BESTÅ frames: 60 wide, 20 deep (the shallow version; 40 also exists), 38 or 64 high.
// Boards ~1.6 cm, hardboard back, one adjustable shelf in the 64-high frame.
// Doors (LAPPVIKEN etc.) are 59.6 wide and 1.6 thick plus bumpers, so frame + door = 22 deep (IKEA lists 60x22x64).
const FRAME_W = 60;
const BOARD = 1.6;
const BACK = 0.3;
const DOOR_T = 1.6;
const DOOR_GAP = 0.4; // bumpers between frame and door
const DOOR_OPEN = 95;

const COLORS: Record<string, string> = { white: '#f2f1ec', 'dark-grey': '#3d3d3f', 'white-oak': '#d8c3a0' };

const num = (v: unknown, d: number) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

/**
 * BESTÅ frames in a grid. Params:
 * - cols: frames side by side (60 cm each)
 * - rows: frame heights bottom → top, e.g. [64, 64, 64] (38 or 64)
 * - depth: 20 (default) or 40
 * - doors: true → a door on every frame; hinges alternate left/right so pairs open like a double door
 * - color: white | dark-grey | white-oak | #hex
 */
export function besta(params: Record<string, unknown>): Generated {
  const cols = Math.max(1, Math.round(num(params.cols, 1)));
  const rows = (Array.isArray(params.rows) ? params.rows : [64]).map((h) => num(h, 64));
  const depth = num(params.depth, 20);
  const doors = params.doors !== false;
  const color = COLORS[String(params.color ?? 'white')] ?? String(params.color);
  const W = cols * FRAME_W;
  const box = (id: string, tags: string[], size: Vec3, position: Vec3, extra: Partial<Part> = {}): Part => ({
    id, tags, geometry: { type: 'box', size }, position, rotation: [0, 0, 0], color, castShadow: true, glass: false, ...extra,
  });

  const parts: Part[] = [];
  const open: Record<string, PartOverride> = {};
  const handles: string[] = [];
  let y0 = 0;
  rows.forEach((h, r) => {
    for (let c = 0; c < cols; c++) {
      const p = `r${r + 1}c${c + 1}`;
      const x0 = -W / 2 + c * FRAME_W;
      const xc = x0 + FRAME_W / 2;
      const yc = y0 + h / 2;
      const innerW = FRAME_W - 2 * BOARD;
      parts.push(
        box(`${p}-left`, ['frame', 'side'], [BOARD, h, depth], [x0 + BOARD / 2, yc, depth / 2]),
        box(`${p}-right`, ['frame', 'side'], [BOARD, h, depth], [x0 + FRAME_W - BOARD / 2, yc, depth / 2]),
        box(`${p}-top`, ['frame', 'top'], [innerW, BOARD, depth], [xc, y0 + h - BOARD / 2, depth / 2]),
        box(`${p}-bottom`, ['frame', 'bottom'], [innerW, BOARD, depth], [xc, y0 + BOARD / 2, depth / 2]),
        box(`${p}-back`, ['frame', 'back'], [innerW, h - 2 * BOARD, BACK], [xc, yc, BACK / 2]),
      );
      if (h >= 50) parts.push(box(`${p}-shelf`, ['shelf'], [innerW, BOARD, depth - BACK - 1], [xc, yc, BACK + (depth - BACK - 1) / 2]));
      if (doors) {
        const left = c % 2 === 0;
        const front = depth + DOOR_GAP;
        const pivot: Vec3 = [left ? x0 : x0 + FRAME_W, yc, front + DOOR_T];
        parts.push(box(`${p}-door`, ['door', 'front'], [FRAME_W - 0.4, h - 0.4, DOOR_T], [xc, yc, front + DOOR_T / 2], { pivot }));
        open[`${p}-door`] = { rotation: [0, left ? -DOOR_OPEN : DOOR_OPEN, 0] };
        handles.push(`${p}-door`);
      }
    }
    y0 += h;
  });

  if (!handles.length) return parts;
  return {
    parts,
    states: [
      { id: 'closed', name: 'Closed', parts: {} },
      { id: 'open', name: 'Doors open', parts: open },
    ],
    interactions: handles.map((part) => ({ part, action: 'cycleStates' as const })),
  };
}
