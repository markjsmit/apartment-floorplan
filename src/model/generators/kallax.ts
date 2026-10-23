import type { Part } from '../schema';

// IKEA Kallax: 1x1 is 42 x 42 cm, each extra cell adds 35 cm; depth 39 cm.
// Outer boards 4.25 cm thick, inner dividers 1.5 cm, cells 33.5 cm inside.
const OUTER = 4.25;
const INNER = 1.5;
const CELL = 33.5;
const DEPTH = 39;

const COLORS: Record<string, string> = {
  white: '#f2f1ec',
  'black-brown': '#2e2622',
  'white-oak': '#d8c3a0',
  oak: '#c9a878',
};

export function kallax(params: Record<string, unknown>): Part[] {
  const cols = Math.max(1, Math.round(Number(params.cols ?? 2)));
  const rows = Math.max(1, Math.round(Number(params.rows ?? 2)));
  const color = COLORS[String(params.color ?? 'white')] ?? String(params.color);
  const W = 2 * OUTER + cols * CELL + (cols - 1) * INNER;
  const H = 2 * OUTER + rows * CELL + (rows - 1) * INNER;
  const zc = DEPTH / 2;
  const box = (id: string, tags: string[], size: [number, number, number], position: [number, number, number]): Part => ({
    id, tags, geometry: { type: 'box', size }, position, rotation: [0, 0, 0], color, castShadow: true, glass: false,
  });

  const parts: Part[] = [
    box('side-left', ['frame', 'side'], [OUTER, H, DEPTH], [-W / 2 + OUTER / 2, H / 2, zc]),
    box('side-right', ['frame', 'side'], [OUTER, H, DEPTH], [W / 2 - OUTER / 2, H / 2, zc]),
    box('top', ['frame', 'top'], [W - 2 * OUTER, OUTER, DEPTH], [0, H - OUTER / 2, zc]),
    box('bottom', ['frame', 'bottom'], [W - 2 * OUTER, OUTER, DEPTH], [0, OUTER / 2, zc]),
  ];
  const innerH = H - 2 * OUTER;
  for (let c = 1; c < cols; c++) {
    const x = -W / 2 + OUTER + c * CELL + (c - 1) * INNER + INNER / 2;
    parts.push(box(`divider-${c}`, ['divider'], [INNER, innerH, DEPTH], [x, H / 2, zc]));
  }
  for (let r = 1; r < rows; r++) {
    const y = OUTER + r * CELL + (r - 1) * INNER + INNER / 2;
    for (let c = 0; c < cols; c++) {
      const x = -W / 2 + OUTER + c * (CELL + INNER) + CELL / 2;
      parts.push(box(`shelf-${r}-${c + 1}`, ['shelf'], [CELL, INNER, DEPTH], [x, y, zc]));
    }
  }
  return parts;
}
