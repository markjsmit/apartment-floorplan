import type { AssetState, FurnitureAsset, Part } from '../schema';
import { kallax, kallaxDesk, kallaxInsert, kallaxUnderframe, lackShelf, swivelChair } from './kallax';
import { besta } from './besta';
import { bridgeShelf, plywoodShelving } from './diy';
import { group } from './group';
import { suitcase } from './suitcase';
import { door, windowParts } from './openings';
import { kitchenCounter, kitchenIsland, kitchenTall, kitchenWallCabinet, plainBox, slidingDoor, trackLight } from './builtins';

// Procedural furniture referenced from asset.json as { "source": { "kind": "procedural", "generator": "<name>" } }.
// Furniture generators follow the item convention: origin back-centre on the floor, +z out of the front.
// Opening generators (door, window) get width/height/wallThickness from the opening; see openings.ts.
// A generator returns parts, or parts plus the states/interactions that go with them (see resolveAsset).
export type Generated = Part[] | { parts: Part[]; states?: AssetState[]; interactions?: FurnitureAsset['interactions'] };
export type Generator = (params: Record<string, unknown>) => Generated;

export const generators: Record<string, Generator> = {
  kallax,
  'kallax-insert': kallaxInsert,
  'kallax-underframe': kallaxUnderframe,
  'kallax-desk': kallaxDesk,
  'lack-shelf': lackShelf,
  'swivel-chair': swivelChair,
  besta,
  'plywood-shelving': plywoodShelving,
  'bridge-shelf': bridgeShelf,
  suitcase,
  group: (params) => group(params, generators),
  door,
  window: windowParts,
  'sliding-door': slidingDoor,
  box: plainBox,
  'kitchen-counter': kitchenCounter,
  'kitchen-island': kitchenIsland,
  'kitchen-tall': kitchenTall,
  'kitchen-wall-cabinet': kitchenWallCabinet,
  'track-light': trackLight,
};
