import { useMemo } from 'react';
import { DoubleSide } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Room } from '../model/schema';
import { resolveWalls, roomBounds, wallSegments } from '../model/geometry';
import { placeRoomItems } from '../model/placement';
import { initialState, resolveAsset } from '../model/assets';
import { useStore } from '../app/store';
import type { Selection } from '../model/lookup';
import { boxWithCmUV, footprintGeometry } from './cmGeometry';
import { getMaterial } from './materials';
import { registerObject } from './registry';
import { PartsView } from './PartsView';

const CLICK_SLOP = 6;

export function RoomView({ room, showCeiling }: { room: Room; showCeiling: boolean }) {
  const bundle = useStore((s) => s.bundle);
  const itemStates = useStore((s) => s.itemStates);
  const select = useStore((s) => s.select);
  const walls = useMemo(() => resolveWalls(room), [room]);
  const bounds = roomBounds(room);
  const placed = useMemo(() => (bundle ? placeRoomItems(room, bundle.furniture, walls, itemStates) : []), [room, bundle, walls, itemStates]);

  const pick = (sel: Selection) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_SLOP) return;
    select(sel);
  };

  return (
    <group>
      <mesh
        ref={registerObject(`${room.id}.floor`)}
        geometry={footprintGeometry(room.footprint, true)}
        rotation={[-Math.PI / 2, 0, 0]}
        material={getMaterial(bundle, room.floor.material)}
        receiveShadow
        onClick={pick({ kind: 'floor', id: `${room.id}.floor`, part: null })}
      />
      <mesh
        ref={registerObject(`${room.id}.ceiling`)}
        geometry={footprintGeometry(room.footprint, false)}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, room.ceilingHeight, 0]}
        material={getMaterial(bundle, room.ceiling.material)}
        visible={showCeiling}
        castShadow
        receiveShadow
        onClick={showCeiling ? pick({ kind: 'ceiling', id: `${room.id}.ceiling`, part: null }) : undefined}
      />

      {/* invisible slab over the room: blocks sunlight from above (the ceiling is hidden in top-down view) */}
      <mesh position={[(bounds.minX + bounds.maxX) / 2, room.ceilingHeight + 13.5, (bounds.minZ + bounds.maxZ) / 2]} castShadow>
        {/* starts 3 cm below the ceiling so the wall/ceiling joint is inside it; casts from both sides
            because three.js renders back faces into shadow maps, which would leave the joint lit */}
        <boxGeometry args={[bounds.maxX - bounds.minX + 80, 33, bounds.maxZ - bounds.minZ + 80]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} shadowSide={DoubleSide} />
      </mesh>

      {walls.map((w) => {
        const t = w.thickness;
        const yaw = Math.atan2(-w.dir[1], w.dir[0]);
        return (
          <group key={w.id} ref={registerObject(w.id)} onClick={pick({ kind: 'wall', id: w.id, part: null })}>
            {wallSegments(w, room.openings, room.ceilingHeight).map((r0) => {
              // run the end pieces past the corners so neighbouring walls overlap (no light leaks)
              const r = {
                u0: r0.u0 === 0 ? -t : r0.u0,
                u1: r0.u1 >= w.length - 0.01 ? w.length + t : r0.u1,
                // and past the floor/ceiling planes, so their edges never show a crack
                y0: r0.y0 <= 0 ? -5 : r0.y0,
                y1: r0.y1 >= room.ceilingHeight - 0.01 ? room.ceilingHeight + 20 : r0.y1,
              };
              const u = (r.u0 + r.u1) / 2;
              const x = w.start[0] + w.dir[0] * u - w.inward[0] * (t / 2);
              const z = w.start[1] + w.dir[1] * u - w.inward[1] * (t / 2);
              return (
                <mesh
                  key={`${r.u0}-${r.y0}`}
                  geometry={boxWithCmUV(r.u1 - r.u0, r.y1 - r.y0, t, [r.u0, r.y0])}
                  material={getMaterial(bundle, w.material)}
                  position={[x, (r.y0 + r.y1) / 2, z]}
                  rotation={[0, yaw, 0]}
                  castShadow
                  receiveShadow
                />
              );
            })}
          </group>
        );
      })}

      {bundle && room.openings.map((o) => {
        const raw = o.asset ? bundle.furniture[o.asset] : undefined;
        const w = walls.find((x) => x.id === o.wall);
        if (!raw || !w) return null;
        const u = o.offset + o.width / 2;
        const asset = resolveAsset(raw, { width: o.width, height: o.height, wallThickness: w.thickness });
        const parts = asset.parts;
        return (
          <PartsView
            key={o.id}
            id={o.id}
            kind="opening"
            asset={asset}
            parts={parts}
            stateId={initialState(asset, o, itemStates[o.id])}
            position={[w.start[0] + w.dir[0] * u, o.sill, w.start[1] + w.dir[1] * u]}
            rotationDeg={(Math.atan2(w.inward[0], w.inward[1]) * 180) / Math.PI}
            selectWhole
          />
        );
      })}

      {placed.map((p) => (
        <PartsView
          key={p.item.id}
          id={p.item.id}
          kind="item"
          asset={p.asset}
          parts={p.parts}
          stateId={p.stateId}
          position={p.position}
          rotationDeg={p.rotationDeg}
          selectWhole={p.item.selectWhole}
        />
      ))}
    </group>
  );
}
