import { create } from 'zustand';

// Kept apart from the main store, like measuring: the gallery is a screen over the 3D view, not house view state.
// The address bar carries `gallery=1` (overview) or `gallery=<room>`, so a link opens it straight away.

type GalleryState = {
  open: boolean;
  /** the room whose pictures are shown; null = the room overview */
  room: string | null;
  /** the picture shown big (index into the room's pictures); null = the grid */
  index: number | null;
  show: (room?: string | null) => void;
  openRoom: (room: string) => void;
  openPicture: (index: number | null) => void;
  /** one step back: big picture → grid → overview → closed */
  back: () => void;
  close: () => void;
};

function syncUrl(s: Pick<GalleryState, 'open' | 'room'>) {
  const q = new URLSearchParams(location.search);
  if (s.open) q.set('gallery', s.room ?? '1');
  else q.delete('gallery');
  history.replaceState(null, '', `?${q.toString()}`);
}

export const useGallery = create<GalleryState>((set, get) => {
  const apply = (next: Partial<GalleryState>) => {
    set(next);
    syncUrl(get());
  };
  return {
    open: false,
    room: null,
    index: null,
    show: (room = null) => apply({ open: true, room, index: null }),
    openRoom: (room) => apply({ room, index: null }),
    openPicture: (index) => set({ index }),
    back: () => {
      const s = get();
      if (s.index !== null) set({ index: null });
      else if (s.room !== null) apply({ room: null });
      else apply({ open: false });
    },
    close: () => apply({ open: false, room: null, index: null }),
  };
});
