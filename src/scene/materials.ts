import { useMemo } from 'react';
import {
  Color, DataTexture, MeshPhysicalMaterial, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader, type Material, type Texture,
} from 'three';
import type { Bundle, LoadedTexture } from '../model/bundle';
import { libUrl } from '../data/client';

const loader = new TextureLoader();
const textureCache = new Map<string, Texture>();
const materialCache = new Map<string, Material>();

// Each room's base light (how much daylight gets in, see roomLightAccess) is a constant "light map" on that room's
// materials: a 1x1 white texture whose intensity Lighting eases per room. Cheap - no extra lights, no extra passes.
const WHITE = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
WHITE.needsUpdate = true;
const roomMaterials = new Map<string, Set<MeshStandardMaterial>>();
const roomFill = new Map<string, number>();
const roomOf = new WeakMap<Material, string>();

function addToRoom(roomId: string, m: MeshStandardMaterial) {
  if (!roomMaterials.has(roomId)) roomMaterials.set(roomId, new Set());
  roomMaterials.get(roomId)!.add(m);
  roomOf.set(m, roomId);
  m.lightMap = WHITE;
  m.lightMapIntensity = roomFill.get(roomId) ?? 0;
}

/** Set a room's base light (every material in it, now and later). */
export function setRoomFill(roomId: string, intensity: number) {
  roomFill.set(roomId, intensity);
  for (const m of roomMaterials.get(roomId) ?? []) m.lightMapIntensity = intensity;
}

/** A copy of a room material (a glowing lamp shade) follows that room's base light too. */
export function sameRoom(base: Material, copy: Material) {
  const r = roomOf.get(base);
  if (r && copy instanceof MeshStandardMaterial) addToRoom(r, copy);
}

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
 * `roomId`: the room it's in, for that room's base light (setRoomFill).
 */
export function getMaterial(bundle: Bundle | null, textureId: string | undefined, tint?: string, glass = false, roomId?: string): Material {
  const t = textureId ? bundle?.textures[textureId] : undefined;
  const key = `${textureId}|${tint}|${glass}|${glass ? '' : (roomId ?? '')}|${t ? JSON.stringify(t) : ''}`;
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
    if (roomId) addToRoom(roomId, mat);
    m = mat;
  }
  materialCache.set(key, m);
  return m;
}

export function useMaterial(bundle: Bundle | null, textureId: string | undefined, tint?: string, glass = false): Material {
  return useMemo(() => getMaterial(bundle, textureId, tint, glass), [bundle, textureId, tint, glass]);
}
