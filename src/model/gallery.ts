import { z } from 'zod';

// The photo gallery: AI renders of the plan, per room. Pictures live in assets/renders/<room>/<name>.jpg with a
// small copy in assets/renders/<room>/thumbs/<name>.jpg (`npm run gallery` makes those); assets/renders/gallery.json
// lists them in order with a caption each.

export const GALLERY_FILE = 'assets/renders/gallery.json';
export const GALLERY_BASE = 'lib/renders/';

export const GalleryPictureSchema = z.object({
  /** path under assets/renders/, e.g. "living/entrance.jpg" */
  file: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+\.jpg$/, 'must be "<room>/<name>.jpg" (lowercase, dashes)'),
  caption: z.string(),
});
export type GalleryPicture = z.infer<typeof GalleryPictureSchema>;

export const GalleryRoomSchema = z.object({
  /** room id in Current (its name is the title unless `title` is set) */
  room: z.string(),
  title: z.string().optional(),
  pictures: z.array(GalleryPictureSchema).min(1),
});
export type GalleryRoom = z.infer<typeof GalleryRoomSchema>;

export const GallerySchema = z.object({
  /** shown under the title on the overview */
  intro: z.string().optional(),
  rooms: z.array(GalleryRoomSchema),
});
export type Gallery = z.infer<typeof GallerySchema>;

/** "living/entrance.jpg" → "living/thumbs/entrance.jpg" */
export function thumbFile(file: string): string {
  const i = file.lastIndexOf('/');
  return `${file.slice(0, i)}/thumbs/${file.slice(i + 1)}`;
}

/** `gallery=1` → the overview, `gallery=<room>` → that room's pictures; null = no gallery in the link. */
export function parseGalleryParam(search: string, rooms: string[]): { room: string | null } | null {
  const v = new URLSearchParams(search).get('gallery');
  if (v === null) return null;
  return { room: rooms.includes(v) ? v : null };
}

/** The link that opens the gallery (overview, or one room). */
export function galleryLink(base: string, room: string | null): string {
  return `${base}?gallery=${room ?? '1'}`;
}
