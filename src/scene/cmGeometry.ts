import { BoxGeometry, BufferGeometry, CylinderGeometry, PlaneGeometry, Shape, ShapeGeometry } from 'three';
import type { Geometry, Vec2 } from '../model/schema';

// All geometry gets UVs in centimetres, so a texture's repeat = 1 / tileSize gives true real-world scale.

const cache = new Map<string, BufferGeometry>();

function cached(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}

/** Box with cm UVs; `uvOffset` shifts the large faces' UVs (used to keep wall textures continuous). */
export function boxWithCmUV(w: number, h: number, d: number, uvOffset: Vec2 = [0, 0]): BufferGeometry {
  return cached(`box:${w}:${h}:${d}:${uvOffset}`, () => {
    const g = new BoxGeometry(w, h, d);
    const uv = g.getAttribute('uv');
    // face order: +x, -x, +y, -y, +z, -z; 4 vertices each
    const scale: [number, number, number, number][] = [
      [d, h, 0, uvOffset[1]], [d, h, 0, uvOffset[1]],
      [w, d, uvOffset[0], 0], [w, d, uvOffset[0], 0],
      [w, h, uvOffset[0], uvOffset[1]], [w, h, uvOffset[0], uvOffset[1]],
    ];
    for (let face = 0; face < 6; face++) {
      const [su, sv, ou, ov] = scale[face];
      for (let i = face * 4; i < face * 4 + 4; i++) uv.setXY(i, uv.getX(i) * su + ou, uv.getY(i) * sv + ov);
    }
    uv.needsUpdate = true;
    return g;
  });
}

export function partGeometry(g: Geometry): BufferGeometry {
  if (g.type === 'box') return boxWithCmUV(g.size[0], g.size[1], g.size[2]);
  if (g.type === 'cylinder') {
    return cached(`cyl:${g.radius}:${g.height}:${g.segments}`, () => {
      const geo = new CylinderGeometry(g.radius, g.radius, g.height, g.segments);
      const uv = geo.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * g.radius, uv.getY(i) * g.height);
      return geo;
    });
  }
  return cached(`plane:${g.size}`, () => {
    const geo = new PlaneGeometry(g.size[0], g.size[1]);
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * g.size[0], uv.getY(i) * g.size[1]);
    return geo;
  });
}

/** Flat polygon in the XY plane from footprint points mapped as (x, flipZ ? -z : z); UVs are cm. */
export function footprintGeometry(footprint: Vec2[], flipZ: boolean): BufferGeometry {
  return cached(`fp:${flipZ}:${JSON.stringify(footprint)}`, () => {
    const shape = new Shape(footprint.map(([x, z]) => ({ x, y: flipZ ? -z : z }) as never));
    return new ShapeGeometry(shape);
  });
}
