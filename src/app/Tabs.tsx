import { versionsForRoom } from '../model/roomVersions';
import { currentHouse, useStore } from './store';

export function Tabs({ showVersions }: { showVersions: boolean }) {
  const bundle = useStore((s) => s.bundle);
  const versionId = useStore((s) => s.versionId);
  const roomId = useStore((s) => s.roomId);
  const setRoom = useStore((s) => s.setRoom);
  const setVersion = useStore((s) => s.setVersion);
  const house = useStore(currentHouse);
  if (!bundle || !house) return null;
  // versions are per room: only the ones about this room (Current always); the other rooms keep theirs
  const offered = roomId ? versionsForRoom(bundle, roomId) : [];
  const versionIds = offered.includes(versionId) || !bundle.versions[versionId] ? offered : [...offered, versionId];

  return (
    <div className="tabs">
      <div className="tab-row rooms">
        {house.rooms.map((r) => (
          <button key={r.id} className={r.id === roomId ? 'tab active' : 'tab'} onClick={() => setRoom(r.id)}>
            {r.name}
          </button>
        ))}
        {house.rooms.length === 0 && <span className="muted">No rooms yet</span>}
      </div>
      {showVersions && (
        <div className="tab-row versions">
          {versionIds.map((id) => {
            const v = bundle.versions[id];
            const kind = v.meta.kind;
            return (
              <button
                key={id}
                className={`tab small ${kind} ${id === versionId ? 'active' : ''}`}
                title={v.meta.note ?? ''}
                onClick={() => setVersion(id)}
              >
                {v.meta.archived ? '❌ ' : kind === 'suggestion' ? '✨ ' : kind === 'saved' ? '📌 ' : kind === 'empty' ? '⬜ ' : ''}
                {v.meta.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
