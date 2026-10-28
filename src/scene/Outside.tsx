import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CircleGeometry, Color, CylinderGeometry, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, MirroredRepeatWrapping,
  RepeatWrapping, SRGBColorSpace, TextureLoader, type Group, type Texture,
} from 'three';
import { boxWithCmUV } from './cmGeometry';
import panoUrl from '../../assets/outside/city-pano.jpg?url';
import panoAlphaUrl from '../../assets/outside/city-pano-alpha.jpg?url';
import stoneUrl from '../../assets/outside/facade-stone.jpg?url';
import glassUrl from '../../assets/outside/facade-glass.jpg?url';

// The view from the 27th floor (assets/outside/source.json): a city panorama far away, drawn behind everything as a
// background that moves with the camera (no parallax, like the real horizon), and two nearby towers as plain boxes
// in house space (procedural facades, placed after the survey photos). The panorama covers 180° (west -> north -> east) and is mirrored for the south, which no window sees.

const R = 20000;
// rows of the panorama are linear in tan(elevation): tan +0.2 at the top, -0.585 at the bottom (see source.json)
const TOP = R * 0.2;
const BOTTOM = -R * (1024 / 1304 - 0.2);
const DEG = Math.PI / 180;

const loader = new TextureLoader();
function load(url: string, color: boolean, wrap: typeof RepeatWrapping | typeof MirroredRepeatWrapping): Texture {
  const t = loader.load(url);
  t.wrapS = wrap;
  t.wrapT = RepeatWrapping;
  if (color) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A nearby tower: a box from the ground (~85 m below the flat) up to `top`, facade photo tiled every `tile` cm. */
type Tower = { x: [number, number]; z: [number, number]; top: number; url: string; tile: [number, number]; roughness: number; metalness: number };

const GROUND = -8500;
const TOWERS: Tower[] = [
  // the residential tower just north-west of the balcony (fills the balcony door in 20261027_160703)
  { x: [-3300, -200], z: [-6200, -4200], top: 3200, url: stoneUrl, tile: [800, 600], roughness: 0.85, metalness: 0 },
  // the glass office tower to the west (tall window, 20261027_160659 / 160723)
  { x: [-7200, -4600], z: [-2600, 900], top: 9500, url: glassUrl, tile: [600, 700], roughness: 0.3, metalness: 0.3 },
];

export function Outside({ northAngle, daylight }: { northAngle: number; daylight: number }) {
  const bg = useRef<Group>(null);
  const { pano, cap, towers } = useMemo(() => {
    const map = load(panoUrl, true, MirroredRepeatWrapping);
    const alpha = load(panoAlphaUrl, false, MirroredRepeatWrapping);
    map.repeat.set(2, 1);
    alpha.repeat.set(2, 1);
    // background: drawn first, never hides anything (no depth test), cut out along the skyline so the sky shows above
    const pano = new MeshBasicMaterial({ map, alphaMap: alpha, alphaTest: 0.5, depthTest: false, depthWrite: false, side: DoubleSide, fog: false });
    const cap = new MeshBasicMaterial({ color: '#8e8a80', depthTest: false, depthWrite: false, side: DoubleSide, fog: false });
    const towers = TOWERS.map((t) => {
      const tex = load(t.url, true, RepeatWrapping);
      tex.repeat.set(1 / t.tile[0], 1 / t.tile[1]);
      return {
        t,
        geometry: boxWithCmUV(t.x[1] - t.x[0], t.top - GROUND, t.z[1] - t.z[0]),
        material: new MeshStandardMaterial({ map: tex, roughness: t.roughness, metalness: t.metalness }),
      };
    });
    return { pano, cap, towers };
  }, []);
  const cylinder = useMemo(() => new CylinderGeometry(R, R, TOP - BOTTOM, 96, 1, true, Math.PI / 2, Math.PI * 2), []);
  const disc = useMemo(() => new CircleGeometry(R, 48), []);

  // dim the city with the daylight (the photos are an overcast afternoon); at night only a faint glow is left
  useEffect(() => {
    const k = 0.1 + 0.9 * Math.min(1, daylight / 0.8);
    pano.color = new Color(k, k * 0.99 + 0.01 * (1 - k), k * 0.97 + 0.05 * (1 - k));
    cap.color = new Color('#8e8a80').multiplyScalar(k);
  }, [daylight, pano, cap]);

  // the background stays centred on the eye: the horizon is always at eye height and never comes nearer
  useFrame(({ camera }) => bg.current?.position.copy(camera.position));

  return (
    <>
      <group ref={bg} rotation={[0, -northAngle * DEG, 0]}>
        {/* mirrored on x so the panorama runs west -> north -> east seen from inside */}
        <mesh geometry={cylinder} material={pano} position={[0, (TOP + BOTTOM) / 2, 0]} scale={[-1, 1, 1]} renderOrder={-1} frustumCulled={false} raycast={() => null} />
        <mesh geometry={disc} material={cap} position={[0, BOTTOM, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1} frustumCulled={false} raycast={() => null} />
      </group>
      <group rotation={[0, -northAngle * DEG, 0]}>
        {towers.map(({ t, geometry, material }, i) => (
          <mesh
            key={i}
            geometry={geometry}
            material={material}
            position={[(t.x[0] + t.x[1]) / 2, (GROUND + t.top) / 2, (t.z[0] + t.z[1]) / 2]}
            raycast={() => null}
          />
        ))}
      </group>
    </>
  );
}
