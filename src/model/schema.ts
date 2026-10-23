import { z } from 'zod';

// All lengths are centimetres, Y is up, angles in JSON are degrees.

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof Vec3Schema>;
export const Vec2Schema = z.tuple([z.number(), z.number()]);
export type Vec2 = z.infer<typeof Vec2Schema>;

export const AssumptionSchema = z.object({ path: z.string(), note: z.string().optional() });
export type Assumption = z.infer<typeof AssumptionSchema>;

const tags = z.array(z.string()).default([]);
const assumptions = z.array(AssumptionSchema).default([]);

export const WallSchema = z.object({
  id: z.string(),
  edge: z.number().int().nonnegative(),
  tags,
  material: z.string().optional(),
  thickness: z.number().positive().default(10),
});
export type Wall = z.infer<typeof WallSchema>;

export const OpeningSchema = z.object({
  id: z.string(),
  type: z.enum(['door', 'window', 'opening']),
  wall: z.string(),
  offset: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive(),
  sill: z.number().nonnegative().default(0),
  asset: z.string().optional(),
  state: z.string().optional(),
  name: z.string().optional(),
  tags,
});
export type Opening = z.infer<typeof OpeningSchema>;

export const ItemSchema = z
  .object({
    id: z.string(),
    asset: z.string(),
    params: z.record(z.unknown()).default({}),
    name: z.string().optional(),
    tags,
    position: Vec3Schema.optional(),
    rotation: z.number().default(0),
    against: z
      .object({ wall: z.string(), offset: z.number(), gap: z.number().default(0), elevation: z.number().default(0) })
      .optional(),
    state: z.string().optional(),
    selectWhole: z.boolean().default(true),
    assumptions,
  })
  .refine((i) => (i.position === undefined) !== (i.against === undefined), {
    message: 'item needs exactly one of "position" or "against"',
  });
export type Item = z.infer<typeof ItemSchema>;

export const SurfaceSchema = z.object({ material: z.string() });

export const RoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  tags,
  footprint: z.array(Vec2Schema).min(3),
  ceilingHeight: z.number().positive(),
  northAngle: z.number().default(0),
  floor: SurfaceSchema,
  ceiling: SurfaceSchema,
  wallMaterial: z.string().default('white-paint'),
  walls: z.array(WallSchema).default([]),
  openings: z.array(OpeningSchema).default([]),
  items: z.array(ItemSchema).default([]),
  assumptions,
});
export type Room = z.infer<typeof RoomSchema>;

export const HouseMetaSchema = z.object({
  name: z.string(),
  kind: z.enum(['current', 'suggestion', 'saved']),
  createdAt: z.string().optional(),
  note: z.string().optional(),
  location: z.object({ lat: z.number(), lon: z.number(), label: z.string().optional() }).optional(),
  baseRoomHashes: z.record(z.string()).optional(),
});
export type HouseMeta = z.infer<typeof HouseMetaSchema>;

export const HouseSchema = z.object({
  meta: HouseMetaSchema,
  rooms: z.array(RoomSchema),
  // Future floorplan: room placement in house coordinates and connections. Ignored by the UI for now.
  layout: z.unknown().nullable().default(null),
  assumptions,
});
export type House = z.infer<typeof HouseSchema>;

// ---------- Assets ----------

export const GeometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('box'), size: Vec3Schema }),
  z.object({
    type: z.literal('cylinder'),
    radius: z.number().positive(),
    height: z.number().positive(),
    segments: z.number().int().default(24),
  }),
  z.object({ type: z.literal('plane'), size: Vec2Schema }),
]);
export type Geometry = z.infer<typeof GeometrySchema>;

export const PartSchema = z.object({
  id: z.string(),
  tags,
  geometry: GeometrySchema.optional(),
  gltfNode: z.string().optional(),
  // Position of the part's geometry centre (box/cylinder) in item-local space.
  position: Vec3Schema.default([0, 0, 0]),
  rotation: Vec3Schema.default([0, 0, 0]),
  // Hinge point in item-local space; state rotations turn around it.
  pivot: Vec3Schema.optional(),
  material: z.string().optional(),
  color: z.string().optional(),
  castShadow: z.boolean().default(true),
  glass: z.boolean().default(false),
});
export type Part = z.infer<typeof PartSchema>;

export const PartOverrideSchema = z.object({
  position: Vec3Schema.optional(),
  rotation: Vec3Schema.optional(),
  visible: z.boolean().optional(),
  material: z.string().optional(),
});
export type PartOverride = z.infer<typeof PartOverrideSchema>;

export const AssetStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  parts: z.record(PartOverrideSchema).default({}),
});
export type AssetState = z.infer<typeof AssetStateSchema>;

export const FurnitureAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  tags,
  description: z.string().optional(),
  source: z.object({
    kind: z.enum(['parts', 'procedural', 'gltf']),
    generator: z.string().optional(),
    file: z.string().optional(),
    notes: z.string().optional(),
    license: z.string().optional(),
  }),
  params: z.record(z.object({ default: z.unknown(), description: z.string().optional() })).default({}),
  // The real product this models (shown in the info panel).
  product: z
    .object({
      vendor: z.string(),
      itemNo: z.string().optional(),
      name: z.string().optional(),
      price: z.number().optional(),
      currency: z.string().optional(),
      url: z.string().optional(),
    })
    .optional(),
  parts: z.array(PartSchema).default([]),
  states: z.array(AssetStateSchema).min(1).default([{ id: 'default', name: 'Default', parts: {} }]),
  defaultState: z.string().optional(),
  interactions: z.array(z.object({ part: z.string(), action: z.literal('cycleStates') })).default([]),
});
export type FurnitureAsset = z.infer<typeof FurnitureAssetSchema>;

export const TextureAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  tags,
  maps: z
    .object({
      color: z.string().optional(),
      normal: z.string().optional(),
      roughness: z.string().optional(),
      ao: z.string().optional(),
    })
    .default({}),
  // Real-world size (cm) one texture tile covers: [along u, along v].
  tileSize: Vec2Schema.default([100, 100]),
  fallbackColor: z.string(),
  roughness: z.number().min(0).max(1).default(0.8),
  metalness: z.number().min(0).max(1).default(0),
  source: z.string().optional(),
  license: z.string().optional(),
});
export type TextureAsset = z.infer<typeof TextureAssetSchema>;
