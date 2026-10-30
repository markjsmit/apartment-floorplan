import { useState } from 'react';
import { Tabs } from './Tabs';
import { share } from './Toolbar';
import { currentHouse, useStore } from './store';
import { DEFAULT_LOCATION, goldenHour } from '../scene/sun';
import { useMeasure } from './measureStore';

/** Phone: rough times of day instead of the desktop's time + date sliders (today's date, golden hour follows the season). */
export function PhoneTimeButtons() {
  const timeOfDay = useStore((s) => s.timeOfDay);
  const dayOfYear = useStore((s) => s.dayOfYear);
  const setTime = useStore((s) => s.setTime);
  const geo = useStore((s) => currentHouse(s)?.meta.location) ?? DEFAULT_LOCATION;
  const golden = goldenHour({ lat: geo.lat, lon: geo.lon, year: new Date().getFullYear(), dayOfYear });
  const times = [
    { label: '☀️', name: 'Afternoon', h: 14 },
    { label: '🌇', name: 'Golden hour', h: golden },
    { label: '🌙', name: 'Night', h: 21.5 },
  ];
  return (
    <div className="seg time-switch">
      {times.map((t) => (
        <button key={t.name} className={Math.abs(timeOfDay - t.h) < 0.01 ? 'on' : ''} onClick={() => setTime(t.h)} aria-label={t.name}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Phone: everything else the desktop shows (rooms, versions, top view, measure, select, share) behind one ☰ button. */
export function PhoneMenu() {
  const [open, setOpen] = useState(false);
  const s = useStore();
  const measuring = useMeasure((m) => m.active);
  const toggleMeasure = useMeasure((m) => m.toggle);
  const close = () => setOpen(false);

  return (
    <>
      <button className={open ? 'menu-button on' : 'menu-button'} onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
      {open && (
        <div className="phone-menu-backdrop" onClick={close}>
          <div
            className="phone-menu"
            onClick={(e) => {
              e.stopPropagation();
              // picking a room or a version closes the menu
              if ((e.target as HTMLElement).closest('.tab')) close();
            }}
          >
            <h3>Rooms &amp; versions</h3>
            <Tabs showVersions />
            <h3>View</h3>
            <div className="menu-row">
              <button className={s.view === 'top-down' ? 'on' : ''} onClick={() => { s.setView(s.view === 'top-down' ? 'first-person' : 'top-down'); close(); }}>
                {s.view === 'top-down' ? '👁 Walk' : '🗺 Top view'}
              </button>
              <button className={measuring ? 'on' : ''} onClick={() => { toggleMeasure(); close(); }}>📏 Measure</button>
              <button className={s.tapSelects ? 'on' : ''} onClick={() => s.setTapSelects(!s.tapSelects)}>
                👆 Select {s.tapSelects ? 'on' : 'off'}
              </button>
            </div>
            <div className="menu-row">
              <button onClick={() => { share(); close(); }}>🔗 Share</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
