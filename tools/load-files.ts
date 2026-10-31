import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBundle, type Bundle, type RawFile, type SiteConfig } from '../src/model/bundle';
import { GALLERY_FILE, thumbFile } from '../src/model/gallery';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

export function readRawFiles(root = ROOT): RawFile[] {
  const rel = (p: string) => path.relative(root, p).split(path.sep).join('/');
  const paths = [
    ...walk(path.join(root, 'house')).filter((p) => p.endsWith('.json')),
    ...walk(path.join(root, 'assets/furniture')).filter((p) => p.endsWith('/asset.json')),
    ...walk(path.join(root, 'assets/textures')).filter((p) => p.endsWith('/texture.json')),
    ...[path.join(root, GALLERY_FILE)].filter((p) => fs.existsSync(p)),
  ];
  return paths.map((p) => {
    const text = fs.readFileSync(p, 'utf8');
    try {
      return { path: rel(p), json: JSON.parse(text) };
    } catch (e) {
      return { path: rel(p), parseError: (e as Error).message };
    }
  });
}

export function readSiteConfig(root = ROOT): SiteConfig {
  try {
    return { publicUrl: '', ...JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8')) };
  } catch {
    return { publicUrl: '' };
  }
}

/** Bundle from disk, plus errors for texture/model files that are referenced but missing. */
export function loadBundleFromDisk(root = ROOT): Bundle {
  const bundle = buildBundle(readRawFiles(root), readSiteConfig(root));
  for (const t of Object.values(bundle.textures)) {
    for (const file of Object.values(t.maps)) {
      if (file && !fs.existsSync(path.join(root, 'assets/textures', t.id, file))) {
        bundle.errors.push({ file: `assets/textures/${t.id}/texture.json`, kind: 'texture', key: t.id, message: `missing map file "${file}"` });
      }
    }
  }
  for (const f of Object.values(bundle.furniture)) {
    if (f.source.file && !fs.existsSync(path.join(root, 'assets/furniture', f.id, f.source.file))) {
      bundle.errors.push({ file: `assets/furniture/${f.id}/asset.json`, kind: 'furniture', key: f.id, message: `missing model file "${f.source.file}"` });
    }
  }
  for (const r of [...(bundle.gallery?.rooms ?? []), ...(bundle.gallery?.experiments ?? [])]) {
    for (const p of r.pictures) {
      for (const file of [p.file, thumbFile(p.file)]) {
        if (!fs.existsSync(path.join(root, 'assets/renders', file))) {
          bundle.errors.push({ file: GALLERY_FILE, kind: 'gallery', key: 'gallery', message: `missing picture "${file}" (npm run gallery makes thumbs)` });
        }
      }
    }
  }
  return bundle;
}
