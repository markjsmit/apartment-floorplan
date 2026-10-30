import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, Sky } from '@react-three/drei';
import { Color, type DirectionalLight, type HemisphereLight, type Material, type PointLight } from 'three';
import type { Sky as SkyMesh } from 'three-stdlib';
import type { HouseFrame } from '../model/layout';
import { polygonCentroid, roomBounds } from '../model/geometry';
import { currentHouse, currentLayout, useStore } from '../app/store';
import { resolveWalls } from '../model/geometry';
import { placeRoomItems } from '../model/placement';
import { assignLampSlots, lampOn, lampScale, roomDaylight, roomLamps, type Lamp, type LightMode } from '../model/lights';
import { moonForMood, sunForMood } from './sun';
import { Outside } from './Outside';


/** Sun (or a faint moon) through the windows (fixed per mood: day / golden hour / night), soft fill for bounced light, the lamps (light mode). */
/** `room` is the whole house frame (bounds, tallest ceiling, north, one lamp per room). */
export function Lighting({ room, mobile }: { room: HouseFrame; mobile: boolean }) {
  const mood = useStore((s) => s.mood);
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

  const dir = useMemo(() => sunForMood(mood, room.northAngle), [mood, room.northAngle]);
  // at night the same light is a faint blue moon: only what comes in through the windows (rooms with windows keep a
  // very low base light, windowless ones go dark - Mark)
  const moon = useMemo(() => moonForMood(mood, room.northAngle), [mood, room.northAngle]);
  const beam = dir ?? moon;
  const elevation = dir ? Math.asin(dir[1]) : 0;
  // warmer and weaker near the horizon
  const sunColor = useMemo(() => (dir ? new Color().setHSL(0.09, 0.9, 0.55 + 0.4 * Math.min(1, elevation / 0.6)) : new Color('#9fb3d6')), [dir, elevation]);
  const sunIntensity = dir ? 2.2 + 3.5 * Math.min(1, elevation / 0.5) : moon ? 0.8 : 0;
  // sky + bounce fill; at night (no sun) nothing
  const daylight = dir ? Math.min(1, 0.25 + elevation * 1.5) : 0;
  // the lamps' bounce, faked: the same everywhere in the house (no seams at doorways), warm in cozy, bright in work -
  // the lamps themselves only add pools of light (Mark: a tool, not a render; work mode should really light the house)
  const mode = useStore((s) => s.lightMode);
  const lampFill = LAMP_FILL[mode];
  // eyes adapting: the brighter the room you stand in is by day, the less the lamps add (Mark); eased over ~1 s so
  // walking from the sunny living room into the dim hallway doesn't pop
  const here = useStore((s) => currentHouse(s)?.rooms.find((r) => r.id === s.roomId));
  const target = lampScale(daylight * (here ? roomDaylight(here) : 1));
  const scale = useRef(target);
  const lampFillRef = useRef<HemisphereLight>(null);
  const lampRefs = useRef<(PointLight | null)[]>([]);
  const litRef = useRef<(Lamp | undefined)[]>([]);
  useFrame((_, dt) => {
    scale.current += (target - scale.current) * Math.min(1, dt * 2.5);
    if (lampFillRef.current) lampFillRef.current.intensity = lampFill.intensity * scale.current;
    lampRefs.current.forEach((l, i) => { if (l) l.intensity = (litRef.current[i]?.intensity ?? 0) * scale.current; });
  });

  const dist = radius * 3;
  const sunPos: [number, number, number] = beam ? [cx + beam[0] * dist, beam[1] * dist, cz + beam[2] * dist] : [cx, -dist, cz];

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
  // a few frames: parts ease into a new state over ~0.3 s and textures/meshes mount a moment after a reload
  const redrawShadows = useCallback(() => { shadowFrames.current = 45; }, []);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    redrawShadows();
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
      <hemisphereLight args={['#f3f6fa', '#e6e3dc', 1.7 * daylight + 0.45 * Math.min(1, daylight * 4) + 0.1 * Math.min(1, daylight * 10) + 0.015]} />
      <ambientLight intensity={0.3 * daylight + 0.005} />
      <hemisphereLight ref={lampFillRef} args={[lampFill.sky, lampFill.ground, lampFill.intensity * scale.current]} />
      <RoomLamps slots={mobile ? 2 : 6} shadows={!mobile} onChange={redrawShadows} lights={lampRefs} litOut={litRef} />
      <Environment resolution={64} environmentIntensity={0.45 * daylight + 0.06 * Math.min(1, daylight * 10) + 0.25 * lampFill.intensity * target + 0.01}>
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

const LAMP_FILL: Record<LightMode, { sky: string; ground: string; intensity: number }> = {
  off: { sky: '#000000', ground: '#000000', intensity: 0 },
  cozy: { sky: '#ffd9ae', ground: '#e8c49a', intensity: 0.9 },
  work: { sky: '#fff3e2', ground: '#efe6d8', intensity: 1.7 },
};

/**
 * The room lights: a fixed pool of point lights (dark when unused) given to the lit lamps of the open room first,
 * then the nearest. Fixed, because adding or removing a light makes three.js recompile every shader (a stutter).
 * Only the nearest casts shadows (point-light shadows are 6 renders each and slow every frame - Mark saw the frame
 * rate drop with all of them); the rest fade out after ~8 m so they don't light rooms far behind walls. Like the
 * sun's, the shadow map is only redrawn when something changes (`onChange`).
 */
function RoomLamps({ slots, shadows, onChange, lights, litOut }: {
  slots: number; shadows: boolean; onChange: () => void;
  /** the point lights + the lamps they show, for Lighting to scale their intensity every frame (eyes adapting) */
  lights: React.MutableRefObject<(PointLight | null)[]>; litOut: React.MutableRefObject<(Lamp | undefined)[]>;
}) {
  const house = useStore(currentHouse);
  const layout = useStore(currentLayout);
  const bundle = useStore((s) => s.bundle);
  const mode = useStore((s) => s.lightMode);
  // where you stand, to the metre (re-picking the lights every frame would redraw their shadows all the time)
  const fx = useStore((s) => Math.round(s.camera.x / 100));
  const fz = useStore((s) => Math.round(s.camera.z / 100));
  const prev = useRef<(Lamp | undefined)[]>([]);
  const lamps = useMemo(
    () => (house && layout && bundle
      ? house.rooms.flatMap((r) => roomLamps(r, placeRoomItems(r, bundle.furniture, resolveWalls(r)), layout.placements[r.id] ?? IDENTITY))
      : []),
    [house, layout, bundle],
  );
  const lit = useMemo(() => {
    const next = assignLampSlots(lamps, (l) => lampOn(l.role, mode), [fx * 100, fz * 100], slots, prev.current);
    prev.current = next;
    return next;
  }, [lamps, mode, fx, fz, slots]);
  useEffect(onChange, [lit, onChange]);
  litOut.current = lit;
  return (
    <>
      {Array.from({ length: slots }, (_, i) => {
        const l = lit[i];
        return (
          <pointLight
            key={i}
            ref={(p) => { lights.current[i] = p; }}
            position={l?.position ?? [0, -1000, 0]}
            color={l?.color ?? '#ffffff'}
            distance={800}
            decay={2}
            castShadow={shadows && i === 0}
            shadow-mapSize={[512, 512]}
            shadow-bias={-0.002}
            shadow-normalBias={1}
            shadow-camera-near={3}
            shadow-camera-far={2000}
          />
        );
      })}
    </>
  );
}
