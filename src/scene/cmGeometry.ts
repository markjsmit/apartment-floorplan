import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, PlaneGeometry, Shape, ShapeGeometry, SphereGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
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

/** Box with rounded edges; cm UVs projected along each vertex's main normal axis. */
function roundedBox(w: number, h: number, d: number, r: number): BufferGeometry {
  return cached(`rbox:${w}:${h}:${d}:${r}`, () => {
    const g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      const [ax, ay, az] = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
      if (ax >= ay && ax >= az) uv.setXY(i, z + d / 2, y + h / 2);
      else if (ay >= az) uv.setXY(i, x + w / 2, z + d / 2);
      else uv.setXY(i, x + w / 2, y + h / 2);
    }
    uv.needsUpdate = true;
    return g;
  });
}

export function partGeometry(g: Geometry): BufferGeometry {
  if (g.type === 'box') return g.radius ? roundedBox(g.size[0], g.size[1], g.size[2], g.radius) : boxWithCmUV(g.size[0], g.size[1], g.size[2]);
  if (g.type === 'cylinder') {
    return cached(`cyl:${g.radius}:${g.height}:${g.segments}`, () => {
      const geo = new CylinderGeometry(g.radius, g.radius, g.height, g.segments);
      const uv = geo.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * g.radius, uv.getY(i) * g.height);
      return geo;
    });
  }
  if (g.type === 'ellipsoid') {
    return cached(`ell:${g.size}:${g.segments}`, () => {
      const [w, h, d] = g.size;
      const geo = new SphereGeometry(0.5, g.segments * 2, g.segments).scale(w, h, d);
      const uv = geo.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * (w + d) / 2, uv.getY(i) * h);
      return geo;
    });
  }
  if (g.type === 'prism') {
    return cached(`prism-part:${g.depth}:${g.bevel}:${JSON.stringify(g.points)}`, () => {
      const shape = new Shape(g.points.map(([x, y]) => ({ x, y }) as never));
      const b = g.bevel;
      const geo = new ExtrudeGeometry(shape, { depth: g.depth - 2 * b, bevelEnabled: b > 0, bevelSize: b, bevelThickness: b, bevelSegments: 3, curveSegments: 8 });
      return geo.translate(0, 0, -(g.depth - 2 * b) / 2);
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

/** A footprint extruded `depth` cm along +z of the XY plane (points mapped like footprintGeometry, flipZ off); UVs are cm. */
export function prismGeometry(footprint: Vec2[], depth: number): BufferGeometry {
  return cached(`prism:${depth}:${JSON.stringify(footprint)}`, () => {
    const shape = new Shape(footprint.map(([x, z]) => ({ x, y: z }) as never));
    return new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  });
}
