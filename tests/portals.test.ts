import { describe, expect, it } from 'vitest';
import { RoomSchema } from '../src/model/schema';
import { resolveWalls } from '../src/model/geometry';
import { portalAt } from '../src/model/portals';

const room = RoomSchema.parse({
  id: 'hall', name: 'Hall', footprint: [[0, 0], [300, 0], [300, 200], [0, 200]], ceilingHeight: 250,
  floor: { material: 'x' }, ceiling: { material: 'x' },
  openings: [
    { id: 'hall.to-bed', type: 'door', wall: 'hall.wall-0', offset: 100, width: 80, height: 210, leadsTo: { room: 'bed', opening: 'bed.door' } },
    { id: 'hall.plain', type: 'door', wall: 'hall.wall-2', offset: 100, width: 80, height: 210 },
  ],
});
const walls = resolveWalls(room);

describe('portalAt', () => {
  it('fires when walking into a linked door', () => {
    expect(portalAt([140, 22], [0, -2], room, walls, 20)?.id).toBe('hall.to-bed');
  });
  it('ignores walking away, walking past the frame, standing further back, and doors without leadsTo', () => {
    expect(portalAt([140, 22], [0, 2], room, walls, 20)).toBeNull();
    expect(portalAt([102, 22], [0, -2], room, walls, 20)).toBeNull();
    expect(portalAt([140, 60], [0, -2], room, walls, 20)).toBeNull();
    expect(portalAt([140, 178], [0, 2], room, walls, 20)).toBeNull();
  });
});
