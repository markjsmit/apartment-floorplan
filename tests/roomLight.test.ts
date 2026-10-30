import { describe, expect, it } from 'vitest';
import { FurnitureAssetSchema, HouseSchema } from '../src/model/schema';
import { computeLayout } from '../src/model/layout';
import { ownLight, roomLightAccess } from '../src/model/roomLight';

const room = (id: string, w: number, d: number, extra: object = {}) => ({
  id, name: id, footprint: [[0, 0], [w, 0], [w, d], [0, d]], ceilingHeight: 260,
  floor: { material: 'f' }, ceiling: { material: 'c' }, ...extra,
});
const doorAsset = FurnitureAssetSchema.parse({
  id: 'door-basic', name: 'Door', source: { kind: 'procedural', generator: 'door' },
  states: [{ id: 'closed', name: 'Closed' }, { id: 'open', name: 'Open', parts: { leaf: { rotation: [0, -90, 0] } } }],
});
// living (big window) -- plain opening -- hall -- door -- bath (no window)
const house = HouseSchema.parse({
  meta: { name: 'Current', kind: 'current' },
  rooms: [
    room('living', 500, 400, { openings: [
      { id: 'living.win', type: 'window', wall: 'living.wall-2', offset: 50, width: 300, height: 180, sill: 40 },
      { id: 'living.o', type: 'opening', wall: 'living.wall-0', offset: 100, width: 120, height: 220, leadsTo: { room: 'hall' } },
    ] }),
    room('hall', 200, 200, { openings: [
      { id: 'hall.o', type: 'opening', wall: 'hall.wall-2', offset: 40, width: 120, height: 220, leadsTo: { room: 'living' } },
      { id: 'hall.d', type: 'door', wall: 'hall.wall-0', offset: 60, width: 80, height: 210, asset: 'door-basic', leadsTo: { room: 'bath' } },
    ] }),
    room('bath', 200, 200, { openings: [{ id: 'bath.d', type: 'door', wall: 'bath.wall-2', offset: 60, width: 80, height: 210, leadsTo: { room: 'hall' } }] }),
  ],
});
const access = (states: Record<string, string>) => roomLightAccess(house, computeLayout(house), { 'door-basic': doorAsset }, states);

describe('roomLightAccess', () => {
  it('a room with a big window is bright, the hall behind an opening less, the bath behind a closed door dark', () => {
    const a = access({});
    expect(a.living).toBeGreaterThan(0.9);
    expect(a.hall).toBeGreaterThan(0.3);
    expect(a.hall).toBeLessThan(a.living);
    expect(a.bath).toBe(0);
  });

  it('opening the door lets some light into the bath, less than the hall gets', () => {
    const a = access({ 'hall.d': 'open' });
    expect(a.bath).toBeGreaterThan(0.05);
    expect(a.bath).toBeLessThan(a.hall);
  });

  it('outdoors is fully lit', () => {
    expect(ownLight(HouseSchema.parse({ meta: { name: 'x', kind: 'current' }, rooms: [room('b', 300, 200, { tags: ['outside'] })] }).rooms[0])).toBe(1);
  });
});
