import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, Sky } from '@react-three/drei';
import { Color, type DirectionalLight, type Material } from 'three';
import type { Sky as SkyMesh } from 'three-stdlib';
import type { HouseFrame } from '../model/layout';
import { polygonCentroid, roomBounds } from '../model/geometry';
import { currentHouse, currentLayout, useStore } from '../app/store';
import { resolveWalls } from '../model/geometry';
import { placeRoomItems } from '../model/placement';
import { assignLampSlots, roomLamps, roomLightOn } from '../model/lights';
import { sunDirection } from './sun';
import { Outside } from './Outside';

const DEFAULT_LOCATION = { lat: 50, lon: 10 };

/** Sun through the windows (real solar position), soft fill for bounced light, the room lights (💡). */
/** `room` is the whole house frame (bounds, tallest ceiling, north, one lamp per room). */
export function Lighting({ room, mobile }: { room: HouseFrame; mobile: boolean }) {
  const timeOfDay = useStore((s) => s.timeOfDay);
  const dayOfYear = useStore((s) => s.dayOfYear);
  const geo = useStore((s) => currentHouse(s)?.meta.location) ?? DEFAULT_LOCATION;
  const sunRef = useRef<DirectionalLight>(null);
  const skyRef = useRef<SkyMesh>(null);
  // the sky is the very back of the background (before the city panorama), never hiding anything
  useEffect(() => {
    const sky = skyRef.current;
    if (!sky) return;
    sky.renderOrder = -2;
    sky.frustumCulled = false;
    (sky.material as Material).depthTest = false;
  }, []);

  const b = roomBounds(room);
  const [cx, cz] = polygonCentroid(room.footprint);
  const radius = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + room.ceilingHeight;

  const dir = useMemo(
    () => sunDirection({ lat: geo.lat, lon: geo.lon, year: new Date().getFullYear(), dayOfYear, hours: timeOfDay, northAngle: room.northAngle }),
    [geo.lat, geo.lon, dayOfYear, timeOfDay, room.northAngle],
  );
  const elevation = dir ? Math.asin(dir[1]) : 0;
  // warmer and weaker near the horizon
  const sunColor = useMemo(() => new Color().setHSL(0.09, 0.9, 0.55 + 0.4 * Math.min(1, elevation / 0.6)), [elevation]);
  const sunIntensity = dir ? 2.2 + 3.5 * Math.min(1, elevation / 0.5) : 0;
  const daylight = dir ? Math.min(1, 0.25 + elevation * 1.5) : 0.04;

  const dist = radius * 3;
  const sunPos: [number, number, number] = dir ? [cx + dir[0] * dist, dir[1] * dist, cz + dir[2] * dist] : [cx, -dist, cz];

  useEffect(() => {
    const l = sunRef.current;
    if (!l) return;
    l.target.position.set(cx, 0, cz);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = dist - radius * 2;
    cam.far = dist + radius * 2;
    cam.updateProjectionMatrix();
  }, [cx, cz, radius, dist]);

  // The sun's shadow map is only redrawn when something that casts changes (sun, house, a door or bed moving, the plan
  // view hiding the ceiling), not every frame: that's every shadow caster drawn a second time, a big cost on phones.
  const gl = useThree((s) => s.gl);
  const house = useStore(currentHouse);
  const itemStates = useStore((s) => s.itemStates);
  const view = useStore((s) => s.view);
  const shadowFrames = useRef(0);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    // a few frames: parts ease into a new state over ~0.3 s and textures/meshes mount a moment after a reload
    shadowFrames.current = 45;
  }, [gl, house, itemStates, view, sunPos[0], sunPos[1], sunPos[2]]);
  useFrame(() => {
    if (shadowFrames.current <= 0) return;
    gl.shadowMap.needsUpdate = true;
    shadowFrames.current--;
  });

  return (
    <>
      <Sky ref={skyRef} distance={15000} sunPosition={dir ? [dir[0], Math.max(dir[1], 0.02), dir[2]] : [0, -1, 0]} turbidity={6} rayleigh={1.5} />
      <directionalLight
        ref={sunRef}
        position={sunPos}
        intensity={sunIntensity}
        color={sunColor}
        castShadow
        shadow-mapSize={[mobile ? 1024 : 2048, mobile ? 1024 : 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={1.5}
      />
      {/* bounced daylight; rooms are closed boxes so this stands in for light coming off the floor and walls */}
      <hemisphereLight args={['#f3f6fa', '#e6e3dc', 1.7 * daylight + 0.45 * Math.min(1, daylight * 4) + 0.1]} />
      <ambientLight intensity={0.3 * daylight + 0.04} />
      <RoomLamps slots={mobile ? 2 : 6} />
      <Environment resolution={64} environmentIntensity={0.45 * daylight + 0.06}>
        <Lightformer form="rect" intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} rotation={[Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={0.6} position={[5, 1, 0]} scale={[10, 3, 1]} rotation={[0, -Math.PI / 2, 0]} color="#ffeedd" />
        <Lightformer form="rect" intensity={0.4} position={[-5, 1, 0]} scale={[10, 3, 1]} rotation={[0, Math.PI / 2, 0]} />
      </Environment>
      {/* the city outside the windows */}
      <Outside northAngle={room.northAngle} daylight={dir ? daylight : 0} />
    </>
  );
}

const IDENTITY = { x: 0, z: 0, rotationDeg: 0 };

/**
 * The room lights: a fixed pool of point lights (dark when unused) given to the lit lamps of the open room first,
 * then the nearest. Fixed, because adding or removing a light makes three.js recompile every shader (a stutter).
 */
function RoomLamps({ slots }: { slots: number }) {
  const house = useStore(currentHouse);
  const layout = useStore(currentLayout);
  const bundle = useStore((s) => s.bundle);
  const roomId = useStore((s) => s.roomId);
  const overrides = useStore((s) => s.roomLights);
  const lamps = useMemo(
    () => (house && layout && bundle
      ? house.rooms.flatMap((r) => roomLamps(r, placeRoomItems(r, bundle.furniture, resolveWalls(r)), layout.placements[r.id] ?? IDENTITY))
      : []),
    [house, layout, bundle],
  );
  const lit = useMemo(() => {
    const own = lamps.filter((l) => l.room === roomId);
    const from: [number, number] = own.length ? [own[0].position[0], own[0].position[2]] : [0, 0];
    return assignLampSlots(lamps, (r) => roomLightOn(overrides, r), roomId, from, slots);
  }, [lamps, overrides, roomId, slots]);
  return (
    <>
      {Array.from({ length: slots }, (_, i) => {
        const l = lit[i];
        return (
          <pointLight
            key={i}
            position={l?.position ?? [0, -1000, 0]}
            intensity={l?.intensity ?? 0}
            color={l?.color ?? '#ffffff'}
            distance={0}
            decay={2}
          />
        );
      })}
    </>
  );
}
