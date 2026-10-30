import { useMemo } from 'react';
import {
  Color, MeshPhysicalMaterial, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader, type Material, type Texture,
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


/**
 * Material for a texture id (+ optional tint). Unknown ids get a neutral grey so mistakes stay visible but harmless.
 */
export function getMaterial(bundle: Bundle | null, textureId: string | undefined, tint?: string, glass = false): Material {
  const t = textureId ? bundle?.textures[textureId] : undefined;
  const key = `${textureId}|${tint}|${glass}|${t ? JSON.stringify(t) : ''}`;
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
    m = mat;
  }
  materialCache.set(key, m);
  return m;
}

export function useMaterial(bundle: Bundle | null, textureId: string | undefined, tint?: string, glass = false): Material {
  return useMemo(() => getMaterial(bundle, textureId, tint, glass), [bundle, textureId, tint, glass]);
}
