import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import { z } from 'zod';

const noteSchema = z.object({
  key: z.string().min(5).max(80),
  note: z.string().trim().min(1).max(5000),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  // Validate: a parcel key (or the older parcelId name) and a note of 1 to 5,000 characters. Anything else is a 400, not a crash or an unbounded row.
  let raw: any;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: 'Invalid Input', message: 'Send a parcel key and a note.' }, { status: 400 }); }
  const parsed = noteSchema.safeParse({ key: raw?.parcelKey || raw?.parcelId, note: raw?.note });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid Input', message: 'A parcel key and a note of 1 to 5,000 characters are required.' }, { status: 400 });
  const { key, note } = parsed.data;

  const client = await pool.connect();
  try {
    // 1. Get User
    const userRes = await client.query('SELECT id FROM users WHERE clerk_id = $1', [userId]);
    const user = userRes.rows[0];
    if (!user) return new NextResponse("User not found", { status: 404 });

    // 2. Insert Note (Append History)
    // No conflict handling - we want history
    await client.query(`
        INSERT INTO user_parcel_notes (user_id, parcel_key, content, created_at)
        VALUES ($1, $2, $3, NOW())
    `, [user.id, key, note]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save Note Error:', error);
    return new NextResponse("Internal Error", { status: 500 });
  } finally {
    client.release();
  }
}
