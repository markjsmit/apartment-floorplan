import { useEffect, useRef, useState } from 'react';
import { EXPERIMENTS, GALLERY_BASE, experimentKey, galleryLink, groupPictures, thumbFile, type GalleryPicture, type GalleryRoom } from '../model/gallery';
import { useStore } from './store';
import { useGallery } from './galleryStore';
import { shorten } from './shortLink';

const url = (file: string) => `${import.meta.env.BASE_URL}${GALLERY_BASE}${file}`;
// a swipe shorter than this (px) is a tap
const SWIPE_PX = 40;

/** Copies a short is.gd link to the gallery (the full link if is.gd can't be reached). */
async function copyShortLink(room: string | null) {
  const s = useStore.getState();
  const base = s.bundle?.site.publicUrl || `${location.origin}${import.meta.env.BASE_URL}`;
  const long = galleryLink(base, room);
  const link = (await shorten(long)) ?? long;
  try {
    await navigator.clipboard.writeText(link);
    s.toast(`Link copied: ${link}`);
  } catch {
    window.prompt('Copy this link', link);
  }
  if (import.meta.env.DEV) s.toast('The link works once the site is released (npm run release).');
}

/** Full-screen photo gallery: rooms → a room's pictures → one picture big (swipe / arrows to the next).
 *  Above the rooms: 🧪 Experiments → an experiment's pictures (grouped) → one picture big. */
export function Gallery() {
  const g = useGallery();
  const gallery = useStore((s) => s.bundle?.gallery ?? null);
  const current = useStore((s) => s.bundle?.versions.current ?? null);
  const titleOf = (r: GalleryRoom) => r.title ?? current?.rooms.find((x) => x.id === r.room)?.name ?? r.room;
  const rooms = (gallery?.rooms ?? []).filter((r) => current?.rooms.some((x) => x.id === r.room));
  const room = rooms.find((r) => r.room === g.room) ?? null;
  const experiments = gallery?.experiments ?? [];
  const onExperiments = g.room === EXPERIMENTS;
  const experiment = experiments.find((e) => experimentKey(e.id) === g.room) ?? null;
  const pictures: GalleryPicture[] = room?.pictures ?? experiment?.pictures ?? [];
  const title = room ? titleOf(room) : experiment ? experiment.title : onExperiments ? '🧪 Experiments' : 'Gallery';
  const backLabel = experiment ? '‹ Experiments' : room || onExperiments ? '‹ Gallery' : '‹ 3D';
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const pic = g.index !== null ? pictures[g.index] : undefined;
  const step = (d: number) => g.index !== null && pictures.length && g.openPicture((g.index + d + pictures.length) % pictures.length);

  // keys belong to the gallery while it's open (not to walking around behind it)
  useEffect(() => {
    if (!g.open) return;
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      e.stopImmediatePropagation();
      if (e.type !== 'keydown') return;
      if (e.key === 'Escape') useGallery.getState().back();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('keyup', key, true);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('keyup', key, true);
    };
  });

  const swipeFrom = useRef<number | null>(null);
  // a swipe ends in a click too: that one mustn't close the picture
  const swiped = useRef(false);
  const [copying, setCopying] = useState(false);
  if (!g.open) return null;

  const share = async () => {
    setCopying(true);
    await copyShortLink(room || experiment || onExperiments ? g.room : null);
    setCopying(false);
  };

  return (
    <div className="gallery">
      <header className="gallery-bar">
        <button onClick={g.back} aria-label="Back">{backLabel}</button>
        <h2>{title}</h2>
        <button onClick={share} disabled={copying}>{copying ? '…' : '🔗 Short link'}</button>
        <button onClick={g.close} aria-label="Close gallery">✕</button>
      </header>

      {!room && !experiment && !onExperiments && (
        <div className="gallery-scroll">
          {gallery?.intro && <p className="gallery-intro">{gallery.intro}</p>}
          {!rooms.length && !experiments.length && <p className="gallery-intro">No pictures yet.</p>}
          <div className="gallery-grid rooms">
            {experiments.length > 0 && (
              <button className="gallery-card experiments" onClick={() => g.openRoom(EXPERIMENTS)}>
                <img src={url(thumbFile(experiments[0].pictures[0].file))} alt="" loading="lazy" />
                <span className="gallery-card-title">🧪 Experiments</span>
                <span className="gallery-card-count">
                  {count(experiments.length, 'experiment', 'experiments')}: things we'd like to see for real, not in the 3D plan
                </span>
              </button>
            )}
            {rooms.map((r) => (
              <button key={r.room} className="gallery-card" onClick={() => g.openRoom(r.room)}>
                <img src={url(thumbFile(r.pictures[0].file))} alt="" loading="lazy" />
                <span className="gallery-card-title">{titleOf(r)}</span>
                <span className="gallery-card-count">{r.pictures.length} {r.pictures.length === 1 ? 'picture' : 'pictures'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {onExperiments && (
        <div className="gallery-scroll">
          <p className="gallery-intro">
            "What if" pictures: other furniture or colours, tried out in a photo of the plan. They're not in the 3D model.
          </p>
          <div className="gallery-grid rooms">
            {experiments.map((e) => (
              <button key={e.id} className="gallery-card" onClick={() => g.openRoom(experimentKey(e.id))}>
                <img src={url(thumbFile(e.pictures[0].file))} alt="" loading="lazy" />
                <span className="gallery-card-title">{e.title}</span>
                <span className="gallery-card-count">{count(e.pictures.length, 'picture', 'pictures')}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {(room || experiment) && (
        <div className="gallery-scroll">
          {experiment?.intro && <p className="gallery-intro">{experiment.intro}</p>}
          {groupPictures(pictures).map(({ group, pictures: ps }, gi) => (
            <section key={gi} className="gallery-group">
              {group && <h3 className="gallery-group-title">{group}</h3>}
              <div className="gallery-grid">
                {ps.map(({ p, i }) => (
                  <button key={p.file} className="gallery-card" onClick={() => g.openPicture(i)}>
                    <img src={url(thumbFile(p.file))} alt={p.caption} loading="lazy" />
                    <span className="gallery-card-caption">{p.caption}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {pic && (
        <div
          className="gallery-big"
          onClick={() => !swiped.current && g.openPicture(null)}
          onPointerDown={(e) => (swipeFrom.current = e.clientX)}
          onPointerUp={(e) => {
            const from = swipeFrom.current;
            swipeFrom.current = null;
            swiped.current = from !== null && Math.abs(e.clientX - from) > SWIPE_PX;
            if (swiped.current) step(e.clientX < from! ? 1 : -1);
          }}
        >
          <img src={url(pic.file)} alt={pic.caption} draggable={false} onClick={(e) => e.stopPropagation()} />
          <div className="gallery-big-caption" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => step(-1)} aria-label="Previous">‹</button>
            <span>{pic.group && <strong>{pic.group}: </strong>}{pic.caption} <em>{g.index! + 1} / {pictures.length}</em></span>
            <button onClick={() => step(1)} aria-label="Next">›</button>
          </div>
          <button className="gallery-big-close" onClick={() => g.openPicture(null)} aria-label="Close picture">✕</button>
        </div>
      )}
    </div>
  );
}
