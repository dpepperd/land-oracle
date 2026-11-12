import { z } from 'zod';

// FIX: More explicit GeoJSON coordinate validation
const coordinateSchema = z.tuple([z.number(), z.number()]); // [lon, lat]

const pointGeometrySchema = z.object({
  type: z.literal('Point'),
  coordinates: coordinateSchema,
});

const polygonGeometrySchema = z.object({
  type: z.literal('Polygon'),
  // Array of linear rings, each ring is array of coordinates
  coordinates: z.array(z.array(coordinateSchema)),
});

const geometrySchema = z.union([pointGeometrySchema, polygonGeometrySchema]);

// FIX: Proper GeoJSON Feature schema for spatialShape
const geoJsonFeatureSchema = z.object({
  type: z.literal('Feature').optional(),
  properties: z.record(z.string(), z.any()).optional(),
  geometry: geometrySchema.optional(),
}).passthrough(); // Allow additional properties like 'coordinates' at top level

export const searchSchema = z.object({
  /** State of the search. Missing means Florida (the live product). 'NC' is an admin-only pilot. */
  state: z.enum(['FL', 'NC']).optional(),
  /** North Carolina pilot: only parcels that look like vacant land (no building value or year). */
  vacantOnly: z.boolean().optional(),
  counties: z.array(z.string()).optional(), 
  landUse: z.array(z.string()).optional(),
  ownerType: z.enum(['all', 'in_state', 'out_of_state']).optional(),
  // Seller signals (lib/sellerSignals.ts)
  absentee: z.boolean().optional(),
  nonHomestead: z.boolean().optional(),
  noSaleYears: z.number().min(1).max(50).optional(),
  limit: z.number().min(1).max(5000).optional(),
  acreageMin: z.number().optional(),
  acreageMax: z.number().optional(),
  marketValueMin: z.number().optional(),
  marketValueMax: z.number().optional(),
  parcelId: z.string().optional(),
  maxDistance: z.number().optional(),
  // FIX: Explicit bbox fields with proper number validation
  minLat: z.number().min(-90).max(90).optional(),
  maxLat: z.number().min(-90).max(90).optional(),
  minLon: z.number().min(-180).max(180).optional(),
  maxLon: z.number().min(-180).max(180).optional(),
  
  // New Address Field
  address: z.string().optional(),

  // FIX: spatialShape can be a GeoJSON Feature or Geometry
  // Using z.any() but with runtime validation in route.ts
  spatialShape: z.any().optional(),
});

export const exportSchema = z.object({
  /** Accepted only so a North Carolina request is refused clearly instead of silently exporting Florida data. */
  state: z.enum(['FL', 'NC']).optional(),
  counties: z.array(z.string()).optional(),
  landUse: z.array(z.string()).optional(),
  ownerType: z.enum(['all', 'in_state', 'out_of_state']).optional(),
  // Seller signals (lib/sellerSignals.ts)
  absentee: z.boolean().optional(),
  nonHomestead: z.boolean().optional(),
  noSaleYears: z.number().min(1).max(50).optional(),
  acreageMin: z.number().optional(),
  acreageMax: z.number().optional(),
  marketValueMin: z.number().optional(),
  marketValueMax: z.number().optional(),
  parcelId: z.string().optional(),
  maxDistance: z.number().optional(),
  minLat: z.number().min(-90).max(90).optional(),
  maxLat: z.number().min(-90).max(90).optional(),
  minLon: z.number().min(-180).max(180).optional(),
  maxLon: z.number().min(-180).max(180).optional(),
  address: z.string().optional(),
  spatialShape: z.any().optional(),
});

export const crmSchema = z.object({
  parcelId: z.string().min(1),
  note: z.string().max(5000),
});

// FIX: Export helper types for TypeScript usage
export type SearchInput = z.infer<typeof searchSchema>;
export type ExportInput = z.infer<typeof exportSchema>;
export type CrmInput = z.infer<typeof crmSchema>;
