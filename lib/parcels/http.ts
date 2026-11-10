// Shared REST wrapper: Clerk auth + error mapping for the /api/v1/parcels routes (also protected by middleware).
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ZodError } from 'zod';
import { AccessError, InputError, NotFoundError } from './access';

export async function withUser(fn: (userId: string) => Promise<unknown>): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await fn(userId), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e: any) {
    if (e instanceof ZodError) return NextResponse.json({ error: 'Invalid input', details: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }, { status: 400 });
    if (e instanceof AccessError || e instanceof InputError || e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[api/v1/parcels]', e?.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
export const keyParam = (raw: string) => decodeURIComponent(raw);
