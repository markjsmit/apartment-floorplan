import { useEffect, useMemo, useRef } from 'react';
import { Environment, Lightformer, Sky } from '@react-three/drei';
import { Color, type DirectionalLight } from 'three';
import type { Room } from '../model/schema';
import { polygonCentroid, roomBounds } from '../model/geometry';
import { currentHouse, useStore } from '../app/store';
import { sunDirection } from './sun';

const DEFAULT_LOCATION = { lat: 50, lon: 10 };

/** Sun through the windows (real solar position), soft fill for bounced light, a ceiling lamp at night. */
export function Lighting({ room, mobile }: { room: Room; mobile: boolean }) {
  const timeOfDay = useStore((s) => s.timeOfDay);
  const dayOfYear = useStore((s) => s.dayOfYear);
  const geo = useStore((s) => currentHouse(s)?.meta.location) ?? DEFAULT_LOCATION;
  const sunRef = useRef<DirectionalLight>(null);

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

  return (
    <>
      <Sky distance={15000} sunPosition={dir ? [dir[0], Math.max(dir[1], 0.02), dir[2]] : [0, -1, 0]} turbidity={6} rayleigh={1.5} />
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
      <hemisphereLight args={['#f4f7fb', '#d8cbb8', 1.7 * daylight + 0.1]} />
      <ambientLight intensity={0.45 * daylight + 0.04} />
      {!dir && <pointLight position={[cx, room.ceilingHeight - 25, cz]} intensity={30000} distance={0} decay={2} color="#ffd9a8" castShadow={!mobile} />}
      <Environment resolution={64} environmentIntensity={0.35 * daylight + 0.05}>
        <Lightformer form="rect" intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} rotation={[Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={0.6} position={[5, 1, 0]} scale={[10, 3, 1]} rotation={[0, -Math.PI / 2, 0]} color="#ffeedd" />
        <Lightformer form="rect" intensity={0.4} position={[-5, 1, 0]} scale={[10, 3, 1]} rotation={[0, Math.PI / 2, 0]} />
      </Environment>
      {/* ground outside, seen through the windows */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -2, cz]} receiveShadow={false}>
        <circleGeometry args={[12000, 32]} />
        <meshStandardMaterial color="#7d8a6a" roughness={1} />
      </mesh>
    </>
  );
}
