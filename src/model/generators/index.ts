import type { Part } from '../schema';
import { kallax } from './kallax';
import { door, windowParts } from './openings';

// Procedural furniture referenced from asset.json as { "source": { "kind": "procedural", "generator": "<name>" } }.
// Furniture generators follow the item convention: origin back-centre on the floor, +z out of the front.
// Opening generators (door, window) get width/height/wallThickness from the opening; see openings.ts.
export const generators: Record<string, (params: Record<string, unknown>) => Part[]> = {
  kallax,
  door,
  window: windowParts,
};
