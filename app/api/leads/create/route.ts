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
      const result = await client.query(
        `INSERT INTO leads (user_id, parcel_key, status) 
         VALUES ($1, $2, 'new') 
         RETURNING id`,
        [internalUserId, parcelId]
      );
      
      return NextResponse.json({ success: true, id: result.rows[0].id });
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
