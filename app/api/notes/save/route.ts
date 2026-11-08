import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { parcelKey, parcelId, note } = await req.json();
  const key = parcelKey || parcelId; // parcel_key (parcelId accepted for older clients)
  if (!key) return new NextResponse("parcel_key required", { status: 400 });

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
