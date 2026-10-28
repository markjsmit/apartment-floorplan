import { useMemo } from 'react';
import {
  Color, DataTexture, MeshPhysicalMaterial, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader, type Material, type Texture,
} from 'three';
import type { Bundle, LoadedTexture } from '../model/bundle';
import { libUrl } from '../data/client';

const loader = new TextureLoader();
const textureCache = new Map<string, Texture>();
const materialCache = new Map<string, Material>();

function loadMap(t: LoadedTexture, file: string, color: boolean): Texture {
  const url = libUrl(t.baseUrl, file);
  const key = `${url}|${t.tileSize}`;
  let tex = textureCache.get(key);
  if (!tex) {
    tex = loader.load(url);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(1 / t.tileSize[0], 1 / t.tileSize[1]);
    tex.anisotropy = 8;
    if (color) tex.colorSpace = SRGBColorSpace;
    textureCache.set(key, tex);
  }
  return tex;
}

const FALLBACK = '#cccccc';

const dimTextures = new Map<number, Texture>();
/** 1x1 "ambient occlusion" of a constant value: scales only the sky/bounce/environment light, not the sun or lamps. */
function dimTexture(k: number): Texture {
  let t = dimTextures.get(k);
  if (!t) {
    const v = Math.round(k * 255);
    t = new DataTexture(new Uint8Array([v, v, v, 255]), 1, 1);
    t.needsUpdate = true;
    dimTextures.set(k, t);
  }
  return t;
}

/**
 * Material for a texture id (+ optional tint). Unknown ids get a neutral grey so mistakes stay visible but harmless.
 * `daylight` (0..1, see roomDaylight) dims the indirect light for rooms with little or no window.
 */
export function getMaterial(bundle: Bundle | null, textureId: string | undefined, tint?: string, glass = false, daylight = 1): Material {
  const t = textureId ? bundle?.textures[textureId] : undefined;
  const key = `${textureId}|${tint}|${glass}|${daylight}|${t ? JSON.stringify(t) : ''}`;
  let m = materialCache.get(key);
  if (m) return m;
  if (glass) {
    // a rough glass texture (glass-frosted) reads as frosted: more opaque, blurry highlights
    const frosted = (t?.roughness ?? 0) > 0.3;
    m = new MeshPhysicalMaterial({
      color: new Color(t?.fallbackColor ?? '#d8ecf2'), roughness: frosted ? t!.roughness : 0.05, metalness: 0, transparent: true,
      opacity: frosted ? 0.6 : 0.18, depthWrite: false,
    });
  } else {
    const mat = new MeshStandardMaterial({
      color: new Color(tint ?? (t?.maps.color ? '#ffffff' : (t?.fallbackColor ?? FALLBACK))),
      roughness: t?.roughness ?? 0.8,
      metalness: t?.metalness ?? 0,
    });
    if (t?.maps.color) mat.map = loadMap(t, t.maps.color, true);
    if (t?.maps.normal) mat.normalMap = loadMap(t, t.maps.normal, false);
    if (t?.maps.roughness) mat.roughnessMap = loadMap(t, t.maps.roughness, false);
    if (t?.maps.ao) mat.aoMap = loadMap(t, t.maps.ao, false);
    if (daylight < 1) {
      if (mat.aoMap) mat.aoMapIntensity = 1 + (1 - daylight);
      else mat.aoMap = dimTexture(daylight);
    }
    m = mat;
  }
  materialCache.set(key, m);
  return m;
}

export function useMaterial(bundle: Bundle | null, textureId: string | undefined, tint?: string, glass = false, daylight = 1): Material {
  return useMemo(() => getMaterial(bundle, textureId, tint, glass, daylight), [bundle, textureId, tint, glass, daylight]);
}
