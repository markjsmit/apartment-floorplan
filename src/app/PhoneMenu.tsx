import { useState } from 'react';
import { Tabs } from './Tabs';
import { share } from './Toolbar';
import { useStore } from './store';
import { useMeasure } from './measureStore';

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
