import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import { crmSchema } from '@/lib/validation';
import { z } from 'zod';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    
    // Zod Validation (renaming props to match schema if needed)
    // Note: Schema expects { parcelId, note }. Body might have { parcel_id, notes }.
    // Let's adapt if needed or use schema strictly.
    // Assuming backend standardizes on camelCase for schema but supports legacy snake_case input.
    const body = crmSchema.parse({
        parcelId: rawBody.parcel_key || rawBody.parcel_id || rawBody.parcelId,
        note: rawBody.notes || rawBody.note || ''
    });

    const { parcelId, note } = body;

    const client = await pool.connect();
    try {
      // Need internal User ID from Clerk ID
      const userRes = await client.query('SELECT id FROM users WHERE clerk_id = $1', [userId]);
      if (userRes.rowCount === 0) {
          // Should not happen if sync is working
          return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
      }
      const internalUserId = userRes.rows[0].id;

      // Note: "leads" table schema usually has snake_case columns
      // Marking the same parcel twice (double click, two tabs) must not create a second row: reuse the existing lead.
      const result = await client.query(
        `INSERT INTO leads (user_id, parcel_key, status)
         SELECT $1, $2, 'new'
         WHERE NOT EXISTS (SELECT 1 FROM leads WHERE user_id = $1 AND parcel_key = $2)
         RETURNING id`,
        [internalUserId, parcelId]
      );
      let leadId = result.rows[0]?.id;
      if (leadId === undefined) {
        leadId = (await client.query('SELECT id FROM leads WHERE user_id = $1 AND parcel_key = $2 ORDER BY id LIMIT 1', [internalUserId, parcelId])).rows[0]?.id;
      }
      return NextResponse.json({ success: true, id: leadId, existing: !result.rows[0] });
    } finally {
      client.release();
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Invalid Input', details: error.issues }, { status: 400 });
    }
    console.error('Create Lead Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}
