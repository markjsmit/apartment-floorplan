import type { AssetState, Part, PartOverride, Vec3 } from '../schema';
import type { Generated } from './index';

// IKEA KALLAX: 1x1 is 42 x 42 cm, each extra cell adds 35 cm; depth 39 cm.
// Outer boards 4.25 cm thick, inner dividers 1.5 cm, cells 33.5 cm inside.
const OUTER = 4.25;
const INNER = 1.5;
const CELL = 33.5;
const DEPTH = 39;

// Inserts are 33 x 37 x 33 (IKEA), fronts flush with the shelf's front edge.
const INSERT_D = 37;
const PANEL = 1.2; // insert carcass board
const FRONT = 1.6; // door / drawer front thickness
const GAP = 0.3; // gap around fronts
const DOOR_OPEN = 95; // degrees
const DRAWER_OUT = 26; // cm a drawer slides out when open
// KALLAX underframe: listed as 18 cm high, but the unit+frame combos are listed as unit + 17 (77x77 → 94,
// 147x147 → 164); 17.5 splits the difference.
export const UNDERFRAME_H = 17.5;
const LEG = 3.5;
const RAIL = 6;

export const COLORS: Record<string, string> = {
  white: '#f2f1ec',
  'black-brown': '#2e2622',
  'white-oak': '#d8c3a0',
  oak: '#c9a878',
};
const FABRIC = '#e9e7e0';
const SHADOW = '#cfcdc6';
const BOX_COLORS: Record<string, string> = { white: FABRIC, black: '#2a2a2a' };

const labelOf = (text: string | undefined, offset: [number, number]): Partial<Part> =>
  text && text.trim() ? { label: { text: text.trim(), size: 2.2, offset, color: '#2b2b2b' } } : {};

/** `labels` param → strings per cell (rows top → bottom, cells left → right); a drawers cell takes "top / bottom". */
function labelGrid(labels: unknown, r: number, c: number): string[] {
  const row = Array.isArray(labels) ? labels[r] : undefined;
  const cell = Array.isArray(row) ? row[c] : undefined;
  return typeof cell === 'string' ? cell.split('/').map((x) => x.trim()) : [];
}

export type ContentKind = 'books' | 'boxes' | 'bins' | 'stuff';
const CONTENT_KINDS: ContentKind[] = ['books', 'boxes', 'bins', 'stuff'];

/** `contents` param → what stands in open cells (rows top → bottom): books | boxes | bins | stuff | random | "". */
function contentGrid(contents: unknown, cols: number, rows: number): (string | null)[][] {
  return Array.from({ length: rows }, (_, r) => {
    const row = typeof contents === 'string' ? contents : Array.isArray(contents) ? contents[r] : undefined;
    const cells = Array.isArray(row) ? row : typeof row === 'string' ? (typeof contents === 'string' ? Array(cols).fill(row) : row.split(/\s+/)) : [];
    return Array.from({ length: cols }, (_, c) => {
      const v = String(cells[c] ?? '').trim().toLowerCase();
      if (v === '' || v === '-' || v === 'none') return null;
      if (v !== 'random' && !CONTENT_KINDS.includes(v as ContentKind)) throw new Error(`kallax: unknown contents "${v}" (use books, boxes, bins, stuff, random or "")`);
      return v;
    });
  });
}

/** Small deterministic random generator so the same cell always gets the same stuff. */
function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const BOOK_COLORS = ['#7a2e2e', '#2e4a7a', '#3d6b4a', '#c9a227', '#ece6d6', '#3a3a3a', '#8a5a9e', '#d06a3a', '#5a8fa8'];

/** Things standing in an open cell whose inside starts at (x0, y0) with its front at z = front. */
function contentParts(kind: string, prefix: string, x0: number, y0: number, front: number): Part[] {
  const rand = rng(prefix);
  const k = (kind === 'random' ? CONTENT_KINDS[Math.floor(rand() * CONTENT_KINDS.length)] : kind) as ContentKind;
  const out: Part[] = [];
  const add = (id: string, size: Vec3, position: Vec3, extra: Partial<Part>) =>
    out.push({ id: `${prefix}-${id}`, tags: ['contents', k], geometry: { type: 'box', size }, position, rotation: [0, 0, 0], castShadow: true, glass: false, ...extra });
  if (k === 'books') {
    let x = x0 + 1;
    for (let i = 0; x < x0 + CELL - 6; i++) {
      const t = 2.2 + rand() * 2.6, h = 19 + rand() * 11, d = 14 + rand() * 9;
      add(`book-${i}`, [t, h, d], [x + t / 2, y0 + h / 2, front - 2 - d / 2], { color: BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)] });
      x += t + 0.15;
    }
  } else if (k === 'boxes') {
    const h1 = 10 + rand() * 6, h2 = 8 + rand() * 6;
    add('box-1', [30, h1, 30], [x0 + CELL / 2, y0 + h1 / 2, front - 3 - 15], { color: '#b48a5a', label: { text: 'Misc', size: 2, offset: [0, 0], color: '#2b2b2b' } });
    add('box-2', [27, h2, 27], [x0 + CELL / 2 + (rand() - 0.5) * 3, y0 + h1 + h2 / 2, front - 4 - 13.5], { color: '#c49a68' });
  } else if (k === 'bins') {
    add('bin', [31, 24, 34], [x0 + CELL / 2, y0 + 12, front - 2 - 17], { color: '#d9dcde' });
  } else {
    add('crate', [18, 12, 22], [x0 + 10, y0 + 6, front - 3 - 11], { color: '#8aa1b1' });
    out.push({
      id: `${prefix}-jar`, tags: ['contents', 'stuff'], geometry: { type: 'cylinder', radius: 4, height: 14, segments: 16 },
      position: [x0 + CELL - 7, y0 + 7, front - 10], rotation: [0, 0, 0], color: '#e0c48a', castShadow: true, glass: false,
    });
    const h = 3 + rand() * 2;
    add('stack', [22, h, 16], [x0 + CELL / 2, y0 + 12 + h / 2, front - 3 - 8], { color: BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)] });
  }
  return out;
}

export type InsertKind = 'door-left' | 'door-right' | 'drawers' | 'shelf' | 'divider' | 'box';
const KINDS: Record<string, InsertKind | null> = {
  '': null, '-': null, open: null, none: null,
  door: 'door-left', 'door-left': 'door-left', 'door-l': 'door-left', 'door-right': 'door-right', 'door-r': 'door-right',
  drawers: 'drawers', shelf: 'shelf', divider: 'divider', box: 'box', drona: 'box', 'dröna': 'box',
};

export function insertKind(s: unknown): InsertKind | null {
  const k = KINDS[String(s ?? '').trim().toLowerCase()];
  if (k === undefined) throw new Error(`kallax: unknown insert "${String(s)}" (use door-left, door-right, drawers, shelf, divider, box or "")`);
  return k;
}

/**
 * `inserts` param → kind per cell, rows top to bottom, cells left to right.
 * Accepts [["door-left", ""], ["drawers", "box"]], ["door-left door-right", "drawers -"] or one string for every cell.
 */
export function insertGrid(inserts: unknown, cols: number, rows: number): (InsertKind | null)[][] {
  const grid: (InsertKind | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    const row = typeof inserts === 'string' ? inserts : Array.isArray(inserts) ? inserts[r] : undefined;
    const cells = Array.isArray(row) ? row : typeof row === 'string' ? (typeof inserts === 'string' ? Array(cols).fill(row) : row.split(/\s+/)) : [];
    grid.push(Array.from({ length: cols }, (_, c) => insertKind(cells[c])));
  }
  return grid;
}

type Box = (id: string, tags: string[], size: Vec3, position: Vec3, extra?: Partial<Part>) => Part;

function boxMaker(color: string): Box {
  return (id, tags, size, position, extra = {}) => ({
    id, tags, geometry: { type: 'box', size }, position, rotation: [0, 0, 0], color, castShadow: true, glass: false, ...extra,
  });
}

type Built = { parts: Part[]; closed: Record<string, PartOverride>; open: Record<string, PartOverride>; handles: string[] };

/**
 * One insert filling a cell whose inside starts at (x0, y0) (left, bottom) and whose front is at z = front.
 * Returns its parts and what changes when it's open.
 */
export function insertParts(
  kind: InsertKind, prefix: string, x0: number, y0: number, front: number, color: string, boxColor = FABRIC, labels: string[] = [],
): Built {
  const box = boxMaker(color);
  const out: Built = { parts: [], closed: {}, open: {}, handles: [] };
  const xc = x0 + CELL / 2;
  const yc = y0 + CELL / 2;
  const back = front - INSERT_D;
  const carcass = () => {
    // thin box lining the cell (visible when the door is open / a drawer is out)
    out.parts.push(
      box(`${prefix}-back`, ['insert'], [CELL, CELL, PANEL], [xc, yc, back + PANEL / 2]),
      box(`${prefix}-top`, ['insert'], [CELL, PANEL, INSERT_D - FRONT], [xc, y0 + CELL - PANEL / 2, back + (INSERT_D - FRONT) / 2]),
      box(`${prefix}-bottom`, ['insert'], [CELL, PANEL, INSERT_D - FRONT], [xc, y0 + PANEL / 2, back + (INSERT_D - FRONT) / 2]),
      box(`${prefix}-left`, ['insert'], [PANEL, CELL - 2 * PANEL, INSERT_D - FRONT], [x0 + PANEL / 2, yc, back + (INSERT_D - FRONT) / 2]),
      box(`${prefix}-right`, ['insert'], [PANEL, CELL - 2 * PANEL, INSERT_D - FRONT], [x0 + CELL - PANEL / 2, yc, back + (INSERT_D - FRONT) / 2]),
    );
  };

  if (kind === 'door-left' || kind === 'door-right') {
    carcass();
    const left = kind === 'door-left';
    const pivot: Vec3 = [left ? x0 : x0 + CELL, yc, front];
    const rot: Vec3 = [0, left ? -DOOR_OPEN : DOOR_OPEN, 0];
    const w = CELL - 2 * GAP;
    out.parts.push(
      box(`${prefix}-door`, ['door', 'front'], [w, w, FRONT], [xc, yc, front - FRONT / 2], { pivot }),
      // small round knob near the opening edge
      {
        id: `${prefix}-knob`, tags: ['handle', 'knob'], geometry: { type: 'cylinder', radius: 1.1, height: 1.6, segments: 16 },
        position: [left ? x0 + CELL - 3 : x0 + 3, yc, front + 0.8], rotation: [90, 0, 0], pivot, color, castShadow: true, glass: false,
      },
    );
    out.open[`${prefix}-door`] = { rotation: rot };
    out.open[`${prefix}-knob`] = { rotation: [90 + 0, rot[1], 0] };
    out.handles.push(`${prefix}-door`, `${prefix}-knob`);
  } else if (kind === 'drawers') {
    carcass();
    const fh = (CELL - 3 * GAP) / 2;
    for (let i = 0; i < 2; i++) {
      const id = `${prefix}-drawer-${i + 1}`; // 1 = top
      const fy = y0 + CELL - GAP - fh / 2 - i * (fh + GAP);
      const bodyH = fh - 4;
      const by = fy - fh / 2 + 1.5 + bodyH / 2;
      const bodyD = INSERT_D - FRONT - PANEL - 1;
      const bz = front - FRONT - bodyD / 2;
      const iw = CELL - 2 * PANEL - 1;
      const drawer: Part[] = [
        box(`${id}-front`, ['drawer', 'front'], [CELL - 2 * GAP, fh, FRONT], [xc, fy, front - FRONT / 2], labelOf(labels[i], [0, -2.2])),
        // finger slot along the top of the front
        box(`${id}-grip`, ['drawer', 'handle'], [12, 1.4, 0.2], [xc, fy + fh / 2 - 2.2, front + 0.05], { color: SHADOW, castShadow: false }),
        box(`${id}-side-l`, ['drawer'], [1, bodyH, bodyD], [x0 + PANEL + 0.5 + 0.5, by, bz]),
        box(`${id}-side-r`, ['drawer'], [1, bodyH, bodyD], [x0 + CELL - PANEL - 1, by, bz]),
        box(`${id}-bottom`, ['drawer'], [iw, 0.6, bodyD], [xc, by - bodyH / 2 + 0.3, bz]),
        box(`${id}-back`, ['drawer'], [iw, bodyH, 1], [xc, by, bz - bodyD / 2 + 0.5]),
      ];
      for (const p of drawer) {
        out.parts.push(p);
        out.open[p.id] = { position: [p.position[0], p.position[1], p.position[2] + DRAWER_OUT] };
      }
      out.handles.push(`${id}-front`, `${id}-grip`);
    }
  } else if (kind === 'shelf') {
    out.parts.push(box(`${prefix}-shelf`, ['insert', 'shelf'], [CELL, INNER, INSERT_D], [xc, yc, front - INSERT_D / 2]));
  } else if (kind === 'divider') {
    out.parts.push(box(`${prefix}-divider`, ['insert', 'divider'], [INNER, CELL, INSERT_D], [xc, yc, front - INSERT_D / 2]));
  } else if (kind === 'box') {
    // DRÖNA fabric box 33 x 38 x 33 with a hand hole in the front
    const s = CELL - 0.8;
    out.parts.push(
      box(`${prefix}-box`, ['box', 'drona'], [s, s, 38], [xc, y0 + 0.4 + s / 2, front - 0.5 - 19], { color: boxColor, ...labelOf(labels[0], [0, 4]) }),
      box(`${prefix}-box-grip`, ['box', 'handle'], [9, 2.5, 0.2], [xc, y0 + s - 4, front - 0.4], { color: SHADOW, castShadow: false }),
    );
  }
  return out;
}

/** KALLAX underframe: a low white frame on four legs, `width` wide (76 or 146), 39 deep, UNDERFRAME_H high. */
export function underframeParts(width: number, color: string, prefix = 'underframe'): Part[] {
  const box = boxMaker(color);
  const H = UNDERFRAME_H;
  const D = DEPTH; // IKEA: 39 deep, like the unit
  const zc = DEPTH / 2;
  const legH = H - RAIL;
  const lx = width / 2 - LEG / 2;
  const lz = D / 2 - LEG / 2;
  const parts: Part[] = [
    box(`${prefix}-rail-front`, ['underframe', 'frame'], [width, RAIL, 2], [0, H - RAIL / 2, zc + D / 2 - 1]),
    box(`${prefix}-rail-back`, ['underframe', 'frame'], [width, RAIL, 2], [0, H - RAIL / 2, zc - D / 2 + 1]),
    box(`${prefix}-rail-left`, ['underframe', 'frame'], [2, RAIL, D - 4], [-width / 2 + 1, H - RAIL / 2, zc]),
    box(`${prefix}-rail-right`, ['underframe', 'frame'], [2, RAIL, D - 4], [width / 2 - 1, H - RAIL / 2, zc]),
  ];
  const legs: [string, number, number][] = [['fl', -lx, lz], ['fr', lx, lz], ['bl', -lx, -lz], ['br', lx, -lz]];
  if (width > 100) legs.push(['fm', 0, lz], ['bm', 0, -lz]);
  for (const [n, x, z] of legs) parts.push(box(`${prefix}-leg-${n}`, ['underframe', 'leg'], [LEG, legH, LEG], [x, legH / 2, zc + z]));
  return parts;
}

/** Outer size. `topRow` = inside height of the top row (33.5 normally; the TV bench's top row is shallower). */
export function kallaxSize(cols: number, rows: number, topRow = CELL) {
  return { w: 2 * OUTER + cols * CELL + (cols - 1) * INNER, h: 2 * OUTER + (rows - 1) * CELL + topRow + (rows - 1) * INNER, d: DEPTH };
}

/** Builds closed/open states from the fronts' overrides (none when nothing opens). */
export function openCloseStates(built: Built[]): { states: AssetState[]; interactions: { part: string; action: 'cycleStates' }[] } {
  const open = Object.assign({}, ...built.map((b) => b.open)) as Record<string, PartOverride>;
  if (!Object.keys(open).length) return { states: [], interactions: [] };
  return {
    states: [
      { id: 'closed', name: 'Closed', parts: {} },
      { id: 'open', name: 'Open', parts: open },
    ],
    interactions: built.flatMap((b) => b.handles).map((part) => ({ part, action: 'cycleStates' as const })),
  };
}

const num = (v: unknown, d: number) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const colorOf = (v: unknown) => COLORS[String(v ?? 'white')] ?? String(v);

/**
 * KALLAX shelving unit. Params:
 * - cols, rows, color
 * - inserts: per cell, rows top → bottom (see insertGrid): door-left | door-right | drawers | shelf | divider | box
 * - labels: text tags per cell, rows top → bottom, [["Tools", ...], ...]; a drawers cell takes "Top / Bottom"
 * - contents: random stuff in open cells, like inserts: books | boxes | bins | stuff | random | "" (seed varies it)
 * - boxColor: DRÖNA box colour (white | black | #hex)
 * - underframe: true → stands on a KALLAX underframe 1 cm narrower than the unit (76 under 77, 146 under 147)
 * - topRow: inside height of the top row in cm (default 33.5; the KALLAX TV bench uses 16.1)
 * - table: { length, width, thickness, height, offset } → a tabletop sticking out of the front (desk combos:
 *   LAGKAPTEN / LINNMON on two OLOV legs at the far end). offset = x of its centre line, 0 = middle.
 */
export function kallax(params: Record<string, unknown>): Generated {
  const cols = Math.max(1, Math.round(num(params.cols, 2)));
  const rows = Math.max(1, Math.round(num(params.rows, 2)));
  const color = colorOf(params.color);
  const boxColor = BOX_COLORS[String(params.boxColor ?? 'white')] ?? String(params.boxColor);
  const frame = params.underframe === true || params.underframe === 'true';
  const topRow = num(params.topRow, CELL);
  const e = frame ? UNDERFRAME_H : 0;
  const { w: W, h: H } = kallaxSize(cols, rows, topRow);
  const zc = DEPTH / 2;
  const box = boxMaker(color);
  // bottom edge of the inside of row r (0 = top row)
  const rowY0 = (r: number) => e + OUTER + (rows - 1 - r) * (CELL + INNER);

  const parts: Part[] = [
    box('side-left', ['frame', 'side'], [OUTER, H, DEPTH], [-W / 2 + OUTER / 2, e + H / 2, zc]),
    box('side-right', ['frame', 'side'], [OUTER, H, DEPTH], [W / 2 - OUTER / 2, e + H / 2, zc]),
    box('top', ['frame', 'top'], [W - 2 * OUTER, OUTER, DEPTH], [0, e + H - OUTER / 2, zc]),
    box('bottom', ['frame', 'bottom'], [W - 2 * OUTER, OUTER, DEPTH], [0, e + OUTER / 2, zc]),
  ];
  const innerH = H - 2 * OUTER;
  for (let c = 1; c < cols; c++) {
    const x = -W / 2 + OUTER + c * CELL + (c - 1) * INNER + INNER / 2;
    parts.push(box(`divider-${c}`, ['divider'], [INNER, innerH, DEPTH], [x, e + H / 2, zc]));
  }
  // shelf-<r>-<c>: r counts boards from the bottom, c columns from the left (1-based)
  for (let r = 1; r < rows; r++) {
    const y = e + OUTER + r * CELL + (r - 1) * INNER + INNER / 2;
    for (let c = 0; c < cols; c++) {
      const x = -W / 2 + OUTER + c * (CELL + INNER) + CELL / 2;
      parts.push(box(`shelf-${r}-${c + 1}`, ['shelf'], [CELL, INNER, DEPTH], [x, y, zc]));
    }
  }
  if (frame) parts.push(...underframeParts(W - 1, color));

  // inserts: cell-<row>-<col>, row 1 = top, col 1 = left; only cells of full height take inserts
  const built: Built[] = [];
  insertGrid(params.inserts, cols, rows).forEach((row, r) =>
    row.forEach((kind, c) => {
      if (!kind || (r === 0 && Math.abs(topRow - CELL) > 0.01)) return;
      const x0 = -W / 2 + OUTER + c * (CELL + INNER);
      built.push(insertParts(kind, `cell-${r + 1}-${c + 1}`, x0, rowY0(r), DEPTH, color, boxColor, labelGrid(params.labels, r, c)));
    }),
  );
  for (const b of built) parts.push(...b.parts);
  // contents: random stuff in open cells (cells with an insert stay as they are)
  const grid = insertGrid(params.inserts, cols, rows);
  contentGrid(params.contents, cols, rows).forEach((row, r) =>
    row.forEach((kind, c) => {
      if (!kind || grid[r][c]) return;
      parts.push(...contentParts(kind, `cell-${r + 1}-${c + 1}-${String(params.seed ?? '')}`, -W / 2 + OUTER + c * (CELL + INNER), rowY0(r), DEPTH));
    }),
  );

  if (params.table && typeof params.table === 'object') parts.push(...tableParts(params.table as Record<string, unknown>));
  return { parts, ...openCloseStates(built) };
}

/** Tabletop out of the unit's front (z = 39 → 39 + length) on two OLOV legs at the far end. */
function tableParts(t: Record<string, unknown>): Part[] {
  const length = num(t.length, 120);
  const width = num(t.width, 60);
  const thick = num(t.thickness, 4);
  const height = num(t.height, 75);
  const x = num(t.offset, 0);
  const top = boxMaker(colorOf(t.color));
  const legH = height - thick;
  const legZ = DEPTH + length - 6;
  const leg = (id: string, lx: number): Part => ({
    id, tags: ['table', 'leg'], geometry: { type: 'cylinder', radius: 2.4, height: legH, segments: 20 },
    position: [lx, legH / 2, legZ], rotation: [0, 0, 0], color: COLORS.white, castShadow: true, glass: false,
  });
  return [
    top('table-top', ['table', 'tabletop', 'desk'], [width, thick, length], [x, height - thick / 2, DEPTH + length / 2]),
    leg('table-leg-left', x - width / 2 + 6),
    leg('table-leg-right', x + width / 2 - 6),
  ];
}

/** One KALLAX insert on its own (as sold), origin back-centre on the floor. Params: insert, color, boxColor. */
export function kallaxInsert(params: Record<string, unknown>): Generated {
  const kind = insertKind(params.insert ?? 'door-left') ?? 'shelf';
  const color = colorOf(params.color);
  const boxColor = BOX_COLORS[String(params.boxColor ?? 'white')] ?? String(params.boxColor);
  if (kind === 'shelf' || kind === 'divider') {
    // a loose board: lying flat for shelf, standing for divider
    const size: Vec3 = kind === 'shelf' ? [CELL, INNER, INSERT_D] : [INNER, CELL, INSERT_D];
    return [boxMaker(color)(`insert-${kind}`, ['insert', kind], size, [0, size[1] / 2, INSERT_D / 2])];
  }
  const b = insertParts(kind, 'insert', -CELL / 2, 0, kind === 'box' ? 38.5 : INSERT_D, color, boxColor);
  return { parts: b.parts, ...openCloseStates([b]) };
}

/** KALLAX underframe on its own. Params: width (76 | 146), color. */
export function kallaxUnderframe(params: Record<string, unknown>): Generated {
  return underframeParts(num(params.width, 76), colorOf(params.color));
}

/**
 * KALLAX desk 111 x 39 x 77: one column of two KALLAX cells (42 wide) at `side` (left | right), the top spanning
 * the full width, a panel leg at the other end and a cable rail along the back. 72 cm free under the top.
 * Params: side, color, inserts (2 rows x 1 col, for the shelf column).
 */
export function kallaxDesk(params: Record<string, unknown>): Generated {
  const color = colorOf(params.color);
  const box = boxMaker(color);
  const W = 111;
  const H = 77;
  const zc = DEPTH / 2;
  const right = String(params.side ?? 'right') !== 'left';
  const s = right ? 1 : -1; // column at +x (right) or -x (left)
  const colOuter = s * (W / 2 - OUTER / 2); // outer side panel centre
  const colInner = s * (W / 2 - OUTER - CELL - OUTER / 2); // partition centre
  const cellX0 = right ? W / 2 - OUTER - CELL : -W / 2 + OUTER;
  const under = H - OUTER;
  const parts: Part[] = [
    box('top', ['frame', 'top', 'desk'], [W, OUTER, DEPTH], [0, H - OUTER / 2, zc]),
    box('side-outer', ['frame', 'side'], [OUTER, under, DEPTH], [colOuter, under / 2, zc]),
    box('partition', ['frame', 'side'], [OUTER, under, DEPTH], [colInner, under / 2, zc]),
    box('bottom', ['frame', 'bottom'], [CELL, OUTER, DEPTH], [cellX0 + CELL / 2, OUTER / 2, zc]),
    box('shelf', ['shelf'], [CELL, INNER, DEPTH], [cellX0 + CELL / 2, OUTER + CELL + INNER / 2, zc]),
    box('leg', ['frame', 'leg'], [OUTER, under, DEPTH], [-s * (W / 2 - OUTER / 2), under / 2, zc]),
    box('cable-rail', ['frame', 'rail'], [W - 2 * OUTER - CELL - OUTER, 8, 1.6], [(-s * (OUTER + CELL)) / 2, under - 4, 2]),
  ];
  const built: Built[] = [];
  insertGrid(params.inserts, 1, 2).forEach((row, r) => {
    const kind = row[0];
    if (kind) built.push(insertParts(kind, `cell-${r + 1}-1`, cellX0, OUTER + (1 - r) * (CELL + INNER), DEPTH, color));
  });
  for (const b of built) parts.push(...b.parts);
  return { parts, ...openCloseStates(built) };
}

/** LACK wall shelf (110 x 26 x 5 by default), floating at `elevation` (bottom), back on the wall. */
export function lackShelf(params: Record<string, unknown>): Generated {
  const w = num(params.width, 110);
  const d = num(params.depth, 26);
  const t = num(params.thickness, 5);
  const y = num(params.elevation, 120);
  return [boxMaker(colorOf(params.color))('shelf', ['shelf', 'lack', 'wall shelf'], [w, t, d], [0, y + t / 2, d / 2])];
}

/** LOBERGET / MALSKÄR swivel chair, approximate (seat height 47, overall ~82). facing: front (+z) | back (-z). */
export function swivelChair(params: Record<string, unknown>): Generated {
  const color = colorOf(params.color);
  const seatH = num(params.seatHeight, 47);
  const flip = String(params.facing ?? 'front') === 'back';
  const box = boxMaker(color);
  // origin back-centre like every item: the seat spans z 0..44
  const cyl = (id: string, tags: string[], radius: number, height: number, y: number, c = '#d9d9d6'): Part => ({
    id, tags, geometry: { type: 'cylinder', radius, height, segments: 24 }, position: [0, y, 22], rotation: [0, 0, 0], color: c, castShadow: true, glass: false,
  });
  // five-spoke swivel base, ⌀ ~60
  const spokes: Part[] = Array.from({ length: 5 }, (_, i) => {
    const a = (i * 72 * Math.PI) / 180;
    return box(`base-${i + 1}`, ['chair', 'base'], [28, 3, 4], [Math.cos(a) * 14, 2.5, 22 - Math.sin(a) * 14], { rotation: [0, i * 72, 0], color: '#d9d9d6' });
  });
  return [
    ...spokes,
    cyl('hub', ['chair', 'base'], 3.5, 5, 3.5),
    cyl('column', ['chair', 'column'], 2.5, seatH - 10, 6 + (seatH - 10) / 2),
    box('seat', ['chair', 'seat'], [48, 4, 44], [0, seatH - 2, 22]),
    box('back', ['chair', 'back'], [46, 34, 3], [0, seatH + 18, flip ? 42.5 : 1.5]),
  ];
}
