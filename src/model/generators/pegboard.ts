import type { Part, Vec3 } from '../schema';

// Pegboard on two floor-to-ceiling posts (2x4 lumber laid flat, wedged with post adjusters such as LABRICO):
// no holes in the wall. Hardboard 6 mm with 6 mm holes on a 25 mm grid, screwed to the posts.
// Item convention: origin back-centre on the floor, x along the wall, +z out into the room.

const num = (v: unknown, d: number) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

/**
 * Params: width, height (board), elevation (bottom of the board), board (thickness), ceiling (post height),
 * postWidth / postDepth (2x4 flat: 8.9 x 3.8), postInset (from the board edge), material, tools (true → demo tools),
 * boards: several sheets on the same posts instead of one, e.g. [{elevation: 40, height: 50}, {elevation: 95, height: 50, tools: false}].
 */
export function pegboard(params: Record<string, unknown>): Part[] {
  const W = num(params.width, 120);
  const t = num(params.board, 0.6);
  const ceiling = num(params.ceiling, 270);
  const pw = num(params.postWidth, 8.9);
  const pd = num(params.postDepth, 3.8);
  const inset = num(params.postInset, 6);
  const material = String(params.material ?? 'pegboard-white');
  const sheets = Array.isArray(params.boards)
    ? (params.boards as Record<string, unknown>[]).map((b) => ({ y0: num(b.elevation, 70), H: num(b.height, 50), tools: b.tools ?? params.tools }))
    : [{ y0: num(params.elevation, 70), H: num(params.height, 120), tools: params.tools }];

  const parts: Part[] = [];
  for (const [i, side] of [[1, -1], [2, 1]] as const) {
    const x = side * (W / 2 - inset - pw / 2);
    parts.push(box(`post-${i}`, ['post', 'frame'], [pw, ceiling - 2, pd], [x, (ceiling - 2) / 2 + 1, pd / 2], { material: 'wood-oak-light' }));
    parts.push(box(`adjuster-${i}`, ['post', 'adjuster'], [pw + 0.6, 2, pd + 0.6], [x, ceiling - 1, pd / 2], { color: '#f4f4f2' }));
  }
  const front = pd + t;
  sheets.forEach(({ y0, H, tools }, i) => {
    const id = sheets.length > 1 ? `board-${i + 1}` : 'board';
    parts.push(box(id, ['pegboard', 'board'], [W, H, t], [0, y0 + H / 2, pd + t / 2], { material }));
    if (tools !== false) parts.push(...boardTools(sheets.length > 1 ? `b${i + 1}-` : '', W, y0, H, front, i));
  });
  return parts;
}

// Demo tools on hooks in rows of ~40 cm, laid out from the left edge; each row starts with a different kind of
// tool so stacked sheets don't look the same. Anything that would stick out past the board is left off.
function boardTools(prefix: string, W: number, y0: number, H: number, front: number, start: number): Part[] {
  const out: Part[] = [];
  const zones: { w: number; add: (id: string, x: number, top: number) => void }[] = [
    { w: 26, add: (id, x, top) => { // screwdriver rack
      out.push(box(`${id}rack`, ['tools', 'rack'], [26, 1.5, 5], [x + 13, top - 14, front + 2.5], { color: '#2b2b2b' }));
      ['#c0392b', '#e1b12c', '#2b2b2b', '#c0392b', '#e1b12c', '#2b2b2b'].forEach((color, i) => {
        const cx = x + 2.5 + i * 4.2, len = 10 + (i % 3) * 3;
        out.push(cyl(`${id}screwdriver-${i}-handle`, ['tools', 'screwdriver'], 1.3, 10, [cx, top - 8, front + 2.5], { color }));
        out.push(cyl(`${id}screwdriver-${i}-shaft`, ['tools', 'screwdriver'], 0.3, len, [cx, top - 14 - len / 2, front + 2.5], { color: '#9aa0a6' }));
      });
    } },
    { w: 26, add: (id, x, top) => { // wrench set, short to long
      for (let i = 0; i < 7; i++) out.push(box(`${id}wrench-${i}`, ['tools', 'wrench'], [1.6, 12 + i * 2.2, 0.6], [x + 2 + i * 3.6, top - 10 - (12 + i * 2.2) / 2, front + 1.2], { color: '#b8bec4' }));
    } },
    { w: 34, add: (id, x, top) => { // small shelf with bins, tape and a tape measure under it
      out.push(box(`${id}shelf`, ['tools', 'shelf'], [34, 1, 12], [x + 17, top - 26, front + 6], { color: '#2b2b2b' }));
      out.push(box(`${id}shelf-lip`, ['tools', 'shelf'], [34, 3, 0.4], [x + 17, top - 24.5, front + 11.8], { color: '#2b2b2b' }));
      ['#d9dcde', '#3d6b4a', '#2e4a7a'].forEach((color, i) => out.push(box(`${id}bin-${i}`, ['tools', 'bin'], [10, 8, 10], [x + 6 + i * 11, top - 21.5, front + 6], { color })));
      out.push(cyl(`${id}tape-measure`, ['tools', 'tape measure'], 3.5, 4, [x + 8, top - 33, front + 2.5], { color: '#e1b12c', rotation: [90, 0, 0] }));
      out.push(cyl(`${id}tape`, ['tools', 'tape'], 4.5, 4.8, [x + 24, top - 33, front + 2.5], { color: '#8a8d91', rotation: [90, 0, 0] }));
    } },
    { w: 22, add: (id, x, top) => { // hammer + pliers
      out.push(box(`${id}hammer-handle`, ['tools', 'hammer'], [2.6, 26, 2], [x + 5, top - 23, front + 2], { color: '#8a5a32' }));
      out.push(box(`${id}hammer-head`, ['tools', 'hammer'], [11, 3, 3], [x + 5, top - 8.5, front + 2], { color: '#3a3a3a' }));
      out.push(box(`${id}pliers-a`, ['tools', 'pliers'], [1.2, 18, 1], [x + 16, top - 20, front + 1.5], { color: '#c0392b', rotation: [0, 0, 7] }));
      out.push(box(`${id}pliers-b`, ['tools', 'pliers'], [1.2, 18, 1], [x + 18, top - 20, front + 1.5], { color: '#c0392b', rotation: [0, 0, -7] }));
    } },
    { w: 24, add: (id, x, top) => { // extension cord coil
      out.push(cyl(`${id}cord`, ['tools', 'cord'], 11, 4, [x + 12, top - 16, front + 2.5], { color: '#2b2b2b', rotation: [90, 0, 0] }));
    } },
  ];
  const rows = Math.max(1, Math.floor((H + 2) / 42));
  for (let r = 0; r < rows; r++) {
    const top = y0 + H - r * 42;
    let x = -W / 2 + 5;
    for (let k = 0; k < zones.length; k++) {
      const z = zones[(start * 2 + r + k) % zones.length];
      if (x + z.w > W / 2 - 2) continue;
      z.add(`${prefix}r${r}-z${k}-`, x, top);
      x += z.w + 6;
    }
  }
  return out;
}

const part = (id: string, tags: string[], geometry: Part['geometry'], position: Vec3, extra: Partial<Part> = {}): Part => ({
  id, tags, geometry, position, rotation: [0, 0, 0], castShadow: true, glass: false, ...extra,
});
const box = (id: string, tags: string[], size: Vec3, position: Vec3, extra: Partial<Part> = {}) => part(id, tags, { type: 'box', size }, position, extra);
const cyl = (id: string, tags: string[], radius: number, height: number, position: Vec3, extra: Partial<Part> = {}) =>
  part(id, tags, { type: 'cylinder', radius, height, segments: 16 }, position, extra);
