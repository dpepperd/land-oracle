// Texas pilot search (admin-only): the shared pilot search configured for Texas. Reads public.parcels_tx_current.
// Texas has no sale dates on the roll, so the no-sale filter is ignored.
import type { NextResponse } from 'next/server';
import type { z } from 'zod';
import { searchPilot, type PilotConfig } from '@/lib/pilotSearch';
import { txCountyCode, TX_CREDIT } from '@/lib/txStates';
import type { searchSchema } from '@/lib/validation';

const TX: PilotConfig = { state: 'TX', label: 'Texas', view: 'parcels_tx_current', countyCode: txCountyCode, credit: TX_CREDIT, hasSaleDate: false };

export const searchTx = (body: z.infer<typeof searchSchema>, userId: string): Promise<NextResponse> => searchPilot(TX, body, userId);
