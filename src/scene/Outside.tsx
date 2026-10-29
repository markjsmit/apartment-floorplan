import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, MeshBasicMaterial, RepeatWrapping,
  SRGBColorSpace, TextureLoader, type Group, type Material, type Texture,
} from 'three';
import panoUrl from '../../assets/outside/city-pano.jpg?url';
import panoAlphaUrl from '../../assets/outside/city-pano-alpha.jpg?url';
import fillUrl from '../../assets/outside/city-fill.jpg?url';
import fillAlphaUrl from '../../assets/outside/city-fill-alpha.jpg?url';
import atlasUrl from '../../assets/outside/facade-atlas.jpg?url';
import atlasAlphaUrl from '../../assets/outside/facade-atlas-alpha.jpg?url';
import groundCityUrl from '../../assets/outside/ground-city.jpg?url';
import groundParkUrl from '../../assets/outside/ground-park.jpg?url';
import { buildCity, grid, GROUND_HALF, GROUND_Y, groundCanvas, PAN_TURN, windowCanvas } from './outsideCity';

// The view from the 27th floor (assets/outside/source.json). Far away: a panorama stitched from Mark's balcony pan
// video, drawn behind everything as a background that moves with the camera (no parallax, like the real horizon):
// bearings PANO_FROM..PANO_TO from the video (south-west over the business district, north to north-east over the
// low-rise), the rest of the circle (east, south: behind the building) put together from other pieces of the video.
// Near: the city in 3D in house space (outsideCity.ts) - the neighbour tower, our tower below the flat, the bases of
// the nearest panorama towers, the low-rise blocks, the park and the streets - meeting the panorama at its bottom
// edge (tan -0.42, ~205 m out), where the painted ground fades out over it.

const R = 20000;
const PANO_FROM = -159.5;
const PANO_TO = 40;
// rows of both panoramas are linear in tan(elevation), from tan +0.6 at the top to -0.42 at the bottom
const TOP = 0.6;
const BOTTOM = -0.42;
const DEG = Math.PI / 180;
// the ground fades out from here to its edge (cm from the eye), over the panorama's bottom rows
const FADE: [number, number] = [20500, 25000];
// what the city hazes into towards the panorama's bottom edge (its rows there: low-rise in the towers' shade)
const SEAM = new Color('#6d6b62');

const loader = new TextureLoader();
function load(url: string, color: boolean): Texture {
  const t = loader.load(url);
  if (color) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** An open cylinder band inside out (seen from its centre) over bearings from..to (degrees, + = east). */
function band(from: number, to: number, segments: number): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const b = (from + ((to - from) * i) / segments) * DEG;
    const x = Math.sin(b) * R;
    const z = -Math.cos(b) * R;
    pos.push(x, BOTTOM * R, z, x, TOP * R, z);
    uv.push(i / segments, 0, i / segments, 1);
    if (i < segments) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Things far out fade into the seam colour; the ground also into nothing at its edge (shader tweak, no fog). */
function haze(m: Material, seam: { value: Color }, fadeOut: boolean) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.seam = seam;
    // per fragment (the ground is one big quad: a distance per vertex would interpolate wrong)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWorldXZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWorldXZ;\nuniform vec3 seam;')
      .replace('#include <opaque_fragment>', [
        'float vDist = distance(vWorldXZ, cameraPosition.xz);',
        'outgoingLight = mix(outgoingLight, seam, smoothstep(9000.0, 23000.0, vDist) * 0.55);',
        fadeOut ? `diffuseColor.a *= 1.0 - smoothstep(${FADE[0].toFixed(1)}, ${FADE[1].toFixed(1)}, vDist);` : '',
        '#include <opaque_fragment>',
      ].join('\n'));
  };
}

export function Outside({ northAngle, daylight }: { northAngle: number; daylight: number }) {
  const bg = useRef<Group>(null);
  const seam = useMemo(() => ({ value: SEAM.clone() }), []);
  const m = useMemo(() => {
    // background: drawn first, never hides anything (no depth test), cut out along the skyline so the sky shows above
    const bgMat = (url: string, alphaUrl: string) =>
      new MeshBasicMaterial({ map: load(url, true), alphaMap: load(alphaUrl, false), alphaTest: 0.5, depthTest: false, depthWrite: false, side: DoubleSide, fog: false });
    const pano = bgMat(panoUrl, panoAlphaUrl);
    const fill = bgMat(fillUrl, fillAlphaUrl);
    // the 3D city: photo facades (atlas) and the generated blocks (vertex colours over a window texture)
    // (no haze on the photo facades: they carry the video's own, and must match the panorama where they meet it)
    const towers = new MeshBasicMaterial({ map: load(atlasUrl, true), alphaMap: load(atlasAlphaUrl, false), alphaTest: 0.5, vertexColors: true, fog: false });
    const winTex = new CanvasTexture(windowCanvas());
    winTex.colorSpace = SRGBColorSpace;
    winTex.wrapS = winTex.wrapT = RepeatWrapping;
    winTex.anisotropy = 4;
    const city = new MeshBasicMaterial({ map: winTex, vertexColors: true, side: DoubleSide, fog: false });
    haze(city, seam, false);
    // depth only: the panorama towers above their 3D bases hide what stands behind them
    const ghosts = new MeshBasicMaterial({ colorWrite: false, side: DoubleSide });
    return { pano, fill, towers, city, ghosts };
  }, [seam]);
  const geo = useMemo(() => {
    const c = buildCity();
    const groundTex = new CanvasTexture(groundCanvas(c.plan));
    groundTex.colorSpace = SRGBColorSpace;
    groundTex.anisotropy = 8;
    // repaint with the aerial photos once they're in (the painted plan shows until then)
    const img = (url: string) => new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    Promise.all([img(groundCityUrl), img(groundParkUrl)]).then(([city, park]) => {
      groundTex.image = groundCanvas(c.plan, { city, park, cityTile: 260, parkTile: 150 });
      groundTex.needsUpdate = true;
    }).catch(() => {});
    const ground = new MeshBasicMaterial({ map: groundTex, transparent: true, depthWrite: false, fog: false });
    haze(ground, seam, true);
    // the painted ground: a square of the city grid round our tower
    const corners = [grid(-GROUND_HALF, -GROUND_HALF), grid(-GROUND_HALF, GROUND_HALF), grid(GROUND_HALF, GROUND_HALF), grid(GROUND_HALF, -GROUND_HALF)];
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(corners.flatMap(([x, z]) => [x, GROUND_Y, z]), 3));
    g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return {
      ...c, groundGeo: g, ground,
      pano: band(PANO_FROM + PAN_TURN, PANO_TO + PAN_TURN, 96),
      fill: band(PANO_TO + PAN_TURN, PANO_FROM + 360 + PAN_TURN, 64),
    };
  }, [seam]);
  useEffect(() => () => {
    for (const g of [geo.towers, geo.city, geo.ghosts, geo.groundGeo, geo.pano, geo.fill]) g.dispose();
    geo.ground.map?.dispose();
    geo.ground.dispose();
  }, [geo]);

  // dim the city with the daylight (the video is golden hour: cooled a little); at night only a faint glow is left
  useEffect(() => {
    const k = 0.1 + 0.9 * Math.min(1, daylight / 0.8);
    const tint = new Color(k * 0.94, k * 0.96 + 0.01 * (1 - k), k * 1.0 + 0.05 * (1 - k));
    m.pano.color = tint;
    m.fill.color = tint;
    m.towers.color = new Color(k, k, k);
    // the generated city a little warm, like the late-afternoon video round it
    for (const mat of [m.city, geo.ground]) mat.color = new Color(k, k * 0.97, k * 0.92);
    seam.value.copy(SEAM).multiplyScalar(k);
  }, [daylight, m, geo, seam]);

  // the background stays centred on the eye: the horizon is always at eye height and never comes nearer
  useFrame(({ camera }) => bg.current?.position.copy(camera.position));

  const none = () => null;
  return (
    <>
      <group ref={bg} rotation={[0, -northAngle * DEG, 0]}>
        <mesh geometry={geo.pano} material={m.pano} renderOrder={-1} frustumCulled={false} raycast={none} />
        <mesh geometry={geo.fill} material={m.fill} renderOrder={-1} frustumCulled={false} raycast={none} />
      </group>
      <group rotation={[0, -northAngle * DEG, 0]}>
        <mesh geometry={geo.ghosts} material={m.ghosts} renderOrder={-0.5} raycast={none} />
        <mesh geometry={geo.towers} material={m.towers} raycast={none} />
        <mesh geometry={geo.city} material={m.city} raycast={none} />
        <mesh geometry={geo.groundGeo} material={geo.ground} raycast={none} />
      </group>
    </>
  );
}
