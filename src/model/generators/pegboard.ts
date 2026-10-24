import type { Part, Vec3 } from '../schema';

// Pegboard on two floor-to-ceiling posts (2x4 lumber laid flat, wedged with post adjusters such as LABRICO):
// no holes in the wall. Hardboard 6 mm with 6 mm holes on a 25 mm grid, screwed to the posts.
// Item convention: origin back-centre on the floor, x along the wall, +z out into the room.

const num = (v: unknown, d: number) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

/**
 * Params: width, height (board), elevation (bottom of the board), board (thickness), ceiling (post height),
 * postWidth / postDepth (2x4 flat: 8.9 x 3.8), postInset (from the board edge), material, tools (true → demo tools).
 */
export function pegboard(params: Record<string, unknown>): Part[] {
  const W = num(params.width, 120);
  const H = num(params.height, 120);
  const y0 = num(params.elevation, 70);
  const t = num(params.board, 0.6);
  const ceiling = num(params.ceiling, 270);
  const pw = num(params.postWidth, 8.9);
  const pd = num(params.postDepth, 3.8);
  const inset = num(params.postInset, 6);
  const material = String(params.material ?? 'pegboard-white');
  const part = (id: string, tags: string[], geometry: Part['geometry'], position: Vec3, extra: Partial<Part> = {}): Part => ({
    id, tags, geometry, position, rotation: [0, 0, 0], castShadow: true, glass: false, ...extra,
  });
  const box = (id: string, tags: string[], size: Vec3, position: Vec3, extra: Partial<Part> = {}) => part(id, tags, { type: 'box', size }, position, extra);
  const cyl = (id: string, tags: string[], radius: number, height: number, position: Vec3, extra: Partial<Part> = {}) =>
    part(id, tags, { type: 'cylinder', radius, height, segments: 16 }, position, extra);

  const parts: Part[] = [];
  for (const [i, side] of [[1, -1], [2, 1]] as const) {
    const x = side * (W / 2 - inset - pw / 2);
    parts.push(box(`post-${i}`, ['post', 'frame'], [pw, ceiling - 2, pd], [x, (ceiling - 2) / 2 + 1, pd / 2], { material: 'wood-oak-light' }));
    parts.push(box(`adjuster-${i}`, ['post', 'adjuster'], [pw + 0.6, 2, pd + 0.6], [x, ceiling - 1, pd / 2], { color: '#f4f4f2' }));
  }
  const front = pd + t;
  parts.push(box('board', ['pegboard', 'board'], [W, H, t], [0, y0 + H / 2, pd + t / 2], { material }));
  if (params.tools === false) return parts;

  // Demo tools on hooks, laid out from the left edge; anything that would stick out past the board is left off.
  const fits = (x0: number, w: number) => x0 + w <= W / 2 - 2;
  const tall = H >= 80; // room for a second row (hammer, cord, lower shelf)
  const top = y0 + H;
  const tools: Part[] = [];
  let x = -W / 2 + 6;
  // Screwdriver rack.
  if (fits(x, 26)) {
    tools.push(box('rack', ['tools', 'rack'], [26, 1.5, 5], [x + 13, top - 14, front + 2.5], { color: '#2b2b2b' }));
    ['#c0392b', '#e1b12c', '#2b2b2b', '#c0392b', '#e1b12c', '#2b2b2b'].forEach((color, i) => {
      const cx = x + 2.5 + i * 4.2;
      tools.push(cyl(`screwdriver-${i}-handle`, ['tools', 'screwdriver'], 1.3, 10, [cx, top - 8, front + 2.5], { color }));
      tools.push(cyl(`screwdriver-${i}-shaft`, ['tools', 'screwdriver'], 0.3, 10 + (i % 3) * 3, [cx, top - 14 - (10 + (i % 3) * 3) / 2, front + 2.5], { color: '#9aa0a6' }));
    });
    // Hammer + pliers below it.
    if (tall) tools.push(box('hammer-handle', ['tools', 'hammer'], [2.6, 28, 2], [x + 5, top - 62, front + 2], { color: '#8a5a32' }));
    if (tall) tools.push(box('hammer-head', ['tools', 'hammer'], [11, 3, 3], [x + 5, top - 47, front + 2], { color: '#3a3a3a' }));
    if (tall) tools.push(box('pliers-a', ['tools', 'pliers'], [1.2, 18, 1], [x + 17, top - 55, front + 1.5], { color: '#c0392b', rotation: [0, 0, 7] }));
    if (tall) tools.push(box('pliers-b', ['tools', 'pliers'], [1.2, 18, 1], [x + 19, top - 55, front + 1.5], { color: '#c0392b', rotation: [0, 0, -7] }));
    x += 32;
  }
  // Wrench set, short to long.
  if (fits(x, 26)) {
    for (let i = 0; i < 7; i++) tools.push(box(`wrench-${i}`, ['tools', 'wrench'], [1.6, 12 + i * 2.2, 0.6], [x + 2 + i * 3.6, top - 10 - (12 + i * 2.2) / 2, front + 1.2], { color: '#b8bec4' }));
    // Extension cord coil below.
    if (tall) tools.push(cyl('cord', ['tools', 'cord'], 11, 4, [x + 13, top - 62, front + 2.5], { color: '#2b2b2b', rotation: [90, 0, 0] }));
    x += 32;
  }
  // Small shelves with bins, tape and a tape measure.
  while (fits(x, 34)) {
    const k = Math.round((x + W / 2) / 34);
    for (const [row, y] of (tall ? [[0, top - 26], [1, top - 66]] : [[0, top - 26]]) as [number, number][]) {
      tools.push(box(`shelf-${k}-${row}`, ['tools', 'shelf'], [34, 1, 12], [x + 17, y, front + 6], { color: '#2b2b2b' }));
      tools.push(box(`shelf-${k}-${row}-lip`, ['tools', 'shelf'], [34, 3, 0.4], [x + 17, y + 1.5, front + 11.8], { color: '#2b2b2b' }));
      ['#d9dcde', '#3d6b4a', '#2e4a7a'].forEach((color, i) => {
        if ((k + row + i) % 4 === 3) return;
        tools.push(box(`bin-${k}-${row}-${i}`, ['tools', 'bin'], [10, 8, 10], [x + 6 + i * 11, y + 4.5, front + 6], { color }));
      });
    }
    if (H >= 50) tools.push(cyl(`tape-measure-${k}`, ['tools', 'tape measure'], 3.5, 4, [x + 8, top - 40, front + 2.5], { color: '#e1b12c', rotation: [90, 0, 0] }));
    if (H >= 50) tools.push(cyl(`tape-${k}`, ['tools', 'tape'], 4.5, 4.8, [x + 24, top - 40, front + 2.5], { color: '#8a8d91', rotation: [90, 0, 0] }));
    x += 40;
  }
  return [...parts, ...tools];
}
