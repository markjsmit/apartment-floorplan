import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, DoubleSide, Matrix4, MeshBasicMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Room } from '../model/schema';
import type { WallInfo } from '../model/geometry';
import { cornerShade, skirtingRuns, type ShadeQuad } from '../model/trim';
import type { Bundle } from '../model/bundle';
import { boxWithCmUV } from './cmGeometry';
import { getMaterial } from './materials';

const noRaycast = () => null;

/** All of a room's skirting boards as one mesh (one draw call per room). */
function skirtingGeometry(room: Room, walls: WallInfo[]): BufferGeometry | null {
  const parts: BufferGeometry[] = [];
  const m = new Matrix4();
  for (const run of skirtingRuns(room, walls)) {
    const w = walls.find((x) => x.id === run.wall)!;
    const yaw = Math.atan2(-w.dir[1], w.dir[0]);
    const len = run.u1 - run.u0;
    const u = (run.u0 + run.u1) / 2;
    // a board with a slimmer top edge (reads as the rounded top of an MDF board), or a plain tile strip
    const pieces: [number, number, number][] = run.material.startsWith('tiles')
      ? [[run.height, run.thickness, run.height / 2]]
      : [[run.height - 0.7, run.thickness, (run.height - 0.7) / 2], [0.7, run.thickness * 0.55, run.height - 0.35]];
    for (const [h, t, y] of pieces) {
      const g = boxWithCmUV(len, h, t, [run.u0, 0]).clone();
      const x = w.start[0] + w.dir[0] * u + w.inward[0] * (t / 2);
      const z = w.start[1] + w.dir[1] * u + w.inward[1] * (t / 2);
      g.applyMatrix4(m.makeRotationY(yaw).setPosition(x, y, z));
      parts.push(g);
    }
  }
  if (!parts.length) return null;
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return merged;
}

function shadeGeometry(quads: ShadeQuad[]): BufferGeometry | null {
  if (!quads.length) return null;
  const pos = new Float32Array(quads.length * 12);
  const col = new Float32Array(quads.length * 16);
  const idx = new Uint32Array(quads.length * 6);
  quads.forEach((q, i) => {
    q.p.forEach((p, k) => pos.set(p, i * 12 + k * 3));
    q.a.forEach((a, k) => col.set([0, 0, 0, a], i * 16 + k * 4));
    idx.set([0, 1, 2, 0, 2, 3].map((v) => v + i * 4), i * 6);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('color', new BufferAttribute(col, 4));
  g.setIndex(new BufferAttribute(idx, 1));
  return g;
}

// black with per-vertex alpha: darkens whatever is behind it, lit or not
const shadeMaterial = new MeshBasicMaterial({
  color: '#000000', vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide, toneMapped: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});

/** Skirting boards and soft corner darkening for one room (room-local; the parent group places the room). */
export function RoomTrim({ room, walls, bundle, showCeiling, shade }: {
  room: Room;
  walls: WallInfo[];
  bundle: Bundle | null;
  showCeiling: boolean;
  /** strength of the corner darkening (lower when screen-space AO already darkens corners) */
  shade: number;
}) {
  const skirting = useMemo(() => skirtingGeometry(room, walls), [room, walls]);
  const corners = useMemo(() => {
    const c = cornerShade(room, walls, shade);
    return { floor: shadeGeometry(c.floor), ceiling: shadeGeometry(c.ceiling) };
  }, [room, walls, shade]);
  useEffect(() => () => {
    skirting?.dispose();
    corners.floor?.dispose();
    corners.ceiling?.dispose();
  }, [skirting, corners]);
  const material = skirting ? getMaterial(bundle, skirtingRuns(room, walls)[0].material) : null;
  return (
    <>
      {skirting && material && <mesh geometry={skirting} material={material} castShadow={false} receiveShadow raycast={noRaycast} />}
      {corners.floor && <mesh geometry={corners.floor} material={shadeMaterial} raycast={noRaycast} renderOrder={1} />}
      {corners.ceiling && <mesh geometry={corners.ceiling} material={shadeMaterial} visible={showCeiling} raycast={noRaycast} renderOrder={1} />}
    </>
  );
}
