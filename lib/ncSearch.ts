// North Carolina pilot search (admin-only): the shared pilot search configured for NC. Reads public.parcels_nc_current.
import type { NextResponse } from 'next/server';
import type { z } from 'zod';
import { searchPilot, type PilotConfig } from '@/lib/pilotSearch';
import { ncCountyCode, NC_CREDIT } from '@/lib/ncStates';
import type { searchSchema } from '@/lib/validation';

const NC: PilotConfig = { state: 'NC', label: 'North Carolina', view: 'parcels_nc_current', countyCode: ncCountyCode, credit: NC_CREDIT, hasSaleDate: true };

export const searchNc = (body: z.infer<typeof searchSchema>, userId: string): Promise<NextResponse> => searchPilot(NC, body, userId);
