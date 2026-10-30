import type { ZodError } from 'zod';
import {
  FurnitureAssetSchema, HouseSchema, TextureAssetSchema,
  type FurnitureAsset, type House, type TextureAsset,
} from './schema';
import { GALLERY_FILE, GallerySchema, type Gallery } from './gallery';
import { EMPTY_ID, emptyVersion, versionIdFromPath } from './versions';

// Everything the viewer needs, as one JSON document: served by the dev server, emitted as bundle.json for the static site.

export type FileKind = 'version' | 'furniture' | 'texture' | 'gallery';
export type FileError = { file: string; kind: FileKind; key: string; message: string };
export type LoadedFurniture = FurnitureAsset & { baseUrl: string };
export type LoadedTexture = TextureAsset & { baseUrl: string };
export type SiteConfig = { publicUrl: string };

export type Bundle = {
  versions: Record<string, House>;
  versionOrder: string[];
  furniture: Record<string, LoadedFurniture>;
  textures: Record<string, LoadedTexture>;
  site: SiteConfig;
  /** the render gallery (null = no assets/renders/gallery.json yet) */
  gallery: Gallery | null;
  errors: FileError[];
};

export type RawFile = { path: string; json?: unknown; parseError?: string };

function classify(path: string): { kind: FileKind; key: string } | null {
  if (path === GALLERY_FILE) return { kind: 'gallery', key: 'gallery' };
  let m = /^house\/(.+)\.json$/.exec(path);
  if (m) return { kind: 'version', key: versionIdFromPath(path) };
  m = /^assets\/furniture\/([^/]+)\/asset\.json$/.exec(path);
  if (m) return { kind: 'furniture', key: m[1] };
  m = /^assets\/textures\/([^/]+)\/texture\.json$/.exec(path);
  if (m) return { kind: 'texture', key: m[1] };
  return null;
}

function formatZod(err: ZodError): string {
  return err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}

function versionRank(id: string, archived = false): string {
  if (id === EMPTY_ID) return '!';
  if (id === 'current') return '0';
  if (id === 'suggestion') return '1';
  return `${archived ? 3 : 2}${id}`;
}

export function buildBundle(files: RawFile[], site: SiteConfig): Bundle {
  const b: Bundle = { versions: {}, versionOrder: [], furniture: {}, textures: {}, site, gallery: null, errors: [] };
  for (const f of files) {
    const c = classify(f.path);
    if (!c) continue;
    const fail = (message: string) => b.errors.push({ file: f.path, ...c, message });
    if (f.parseError !== undefined) {
      fail(`invalid JSON: ${f.parseError}`);
      continue;
    }
    if (c.kind === 'version') {
      const r = HouseSchema.safeParse(f.json);
      if (r.success) b.versions[c.key] = r.data;
      else fail(formatZod(r.error));
    } else if (c.kind === 'furniture') {
      const r = FurnitureAssetSchema.safeParse(f.json);
      if (!r.success) fail(formatZod(r.error));
      else if (r.data.id !== c.key) fail(`id "${r.data.id}" must match its folder name "${c.key}"`);
      else b.furniture[c.key] = { ...r.data, baseUrl: `lib/furniture/${c.key}/` };
    } else if (c.kind === 'gallery') {
      const r = GallerySchema.safeParse(f.json);
      if (r.success) b.gallery = r.data;
      else fail(formatZod(r.error));
    } else {
      const r = TextureAssetSchema.safeParse(f.json);
      if (!r.success) fail(formatZod(r.error));
      else if (r.data.id !== c.key) fail(`id "${r.data.id}" must match its folder name "${c.key}"`);
      else b.textures[c.key] = { ...r.data, baseUrl: `lib/textures/${c.key}/` };
    }
  }
  return withEmpty(b);
}

/** Adds the derived Empty version (from Current) and sorts the version order. */
function withEmpty(b: Bundle): Bundle {
  delete b.versions[EMPTY_ID];
  if (b.versions.current) b.versions[EMPTY_ID] = emptyVersion(b.versions.current);
  b.versionOrder = sortVersions(b.versions);
  return b;
}

function sortVersions(versions: Bundle['versions']): string[] {
  const rank = (id: string) => versionRank(id, versions[id].meta.archived);
  return Object.keys(versions).sort((a, b) => (rank(a) < rank(b) ? -1 : 1));
}

/** For files that failed to load in `next`, keep what `prev` had, so a half-saved edit doesn't blank the view. */
export function mergeBundle(prev: Bundle | null, next: Bundle): Bundle {
  if (!prev) return next;
  const merged: Bundle = {
    ...next,
    versions: { ...next.versions },
    furniture: { ...next.furniture },
    textures: { ...next.textures },
  };
  for (const e of next.errors) {
    if (e.kind === 'version' && prev.versions[e.key]) merged.versions[e.key] = prev.versions[e.key];
    if (e.kind === 'furniture' && prev.furniture[e.key]) merged.furniture[e.key] = prev.furniture[e.key];
    if (e.kind === 'texture' && prev.textures[e.key]) merged.textures[e.key] = prev.textures[e.key];
    if (e.kind === 'gallery') merged.gallery = prev.gallery;
  }
  return withEmpty(merged);
}
