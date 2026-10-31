import { z } from 'zod';

// The photo gallery: AI renders of the plan, per room. Pictures live in assets/renders/<room>/<name>.jpg with a
// small copy in assets/renders/<room>/thumbs/<name>.jpg (`npm run gallery` makes those); assets/renders/gallery.json
// lists them in order with a caption each.
// Experiments (shown above the rooms) are "how would X look" renders that are NOT in the 3D model, e.g. other
// dining tables: assets/renders/experiments/<id>/<name>.jpg, one entry per experiment, pictures optionally grouped.

export const GALLERY_FILE = 'assets/renders/gallery.json';
export const GALLERY_BASE = 'lib/renders/';

export const GalleryPictureSchema = z.object({
  /** path under assets/renders/, e.g. "living/entrance.jpg" */
  file: z.string().regex(/^[a-z0-9-]+(\/[a-z0-9-]+)*\/[a-z0-9-]+\.jpg$/, 'must be "<room>/<name>.jpg" (lowercase, dashes)'),
  caption: z.string(),
  /** experiments: pictures with the same group are shown together under that heading */
  group: z.string().optional(),
});
export type GalleryPicture = z.infer<typeof GalleryPictureSchema>;

export const GalleryRoomSchema = z.object({
  /** room id in Current (its name is the title unless `title` is set) */
  room: z.string(),
  title: z.string().optional(),
  pictures: z.array(GalleryPictureSchema).min(1),
});
export type GalleryRoom = z.infer<typeof GalleryRoomSchema>;

export const GalleryExperimentSchema = z.object({
  /** lowercase-dashes; its pictures live in assets/renders/experiments/<id>/ */
  id: z.string().regex(/^[a-z0-9-]+$/, 'lowercase, dashes'),
  title: z.string(),
  /** what was tried, shown above the pictures */
  intro: z.string().optional(),
  pictures: z.array(GalleryPictureSchema).min(1),
});
export type GalleryExperiment = z.infer<typeof GalleryExperimentSchema>;

export const GallerySchema = z.object({
  /** shown under the title on the overview */
  intro: z.string().optional(),
  /** "what if" renders that aren't in the 3D model; a category above the rooms */
  experiments: z.array(GalleryExperimentSchema).optional(),
  rooms: z.array(GalleryRoomSchema),
});
export type Gallery = z.infer<typeof GallerySchema>;

/** "living/entrance.jpg" → "living/thumbs/entrance.jpg" */
export function thumbFile(file: string): string {
  const i = file.lastIndexOf('/');
  return `${file.slice(0, i)}/thumbs/${file.slice(i + 1)}`;
}

/** The gallery's page keys: `experiments` = the list of experiments, `experiments/<id>` = one experiment. */
export const EXPERIMENTS = 'experiments';
export const experimentKey = (id: string) => `${EXPERIMENTS}/${id}`;

/** Every page key a link may open: the rooms, plus the experiments list and each experiment. */
export function galleryKeys(g: Gallery | null): string[] {
  if (!g) return [];
  const ex = g.experiments ?? [];
  return [...g.rooms.map((r) => r.room), ...(ex.length ? [EXPERIMENTS, ...ex.map((e) => experimentKey(e.id))] : [])];
}

/** One step up from a page: an experiment → the experiments list → the overview (null). */
export function parentKey(key: string): string | null {
  return key.startsWith(`${EXPERIMENTS}/`) ? EXPERIMENTS : null;
}

/** `gallery=1` → the overview, `gallery=<key>` → that room / experiment; null = no gallery in the link. */
export function parseGalleryParam(search: string, keys: string[]): { room: string | null } | null {
  const v = new URLSearchParams(search).get('gallery');
  if (v === null) return null;
  return { room: keys.includes(v) ? v : null };
}

/** Pictures in show order with their group heading (consecutive pictures of one group share it). */
export function groupPictures(pictures: GalleryPicture[]): { group: string | null; pictures: { p: GalleryPicture; i: number }[] }[] {
  const out: { group: string | null; pictures: { p: GalleryPicture; i: number }[] }[] = [];
  pictures.forEach((p, i) => {
    const g = p.group ?? null;
    const last = out[out.length - 1];
    if (last && last.group === g) last.pictures.push({ p, i });
    else out.push({ group: g, pictures: [{ p, i }] });
  });
  return out;
}

/** The link that opens the gallery (overview, or one room / experiment). */
export function galleryLink(base: string, room: string | null): string {
  return `${base}?gallery=${room ?? '1'}`;
}
