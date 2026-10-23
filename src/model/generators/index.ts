import type { Part } from '../schema';
import { kallax } from './kallax';

// Procedural furniture referenced from asset.json as { "source": { "kind": "procedural", "generator": "<name>" } }.
// Generated parts follow the item convention: origin back-centre on the floor, +z out of the front.
export const generators: Record<string, (params: Record<string, unknown>) => Part[]> = {
  kallax,
};
