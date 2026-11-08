import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';

// [id] is the parcel_key (e.g. "FL-20-41-04-26-019193-000-00").
// Owner / contact data now comes from the Florida DOR roll (dor.nal_2026) and is NOT editable here.
// Admins may still save a private note for the parcel.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const parcelKey = decodeURIComponent((await params).id);
  const { notes, owner_name, phone_number, email, phone_verified, email_verified } = await req.json();

  if ([owner_name, phone_number, email, phone_verified, email_verified].some((v) => v !== undefined)) {
    return NextResponse.json(
      { error: 'Owner and contact data come from the 2026 DOR roll and cannot be edited.' },
      { status: 403 }
    );
  }

  const client = await pool.connect();
  try {
    const userRes = await client.query('SELECT id, role FROM users WHERE clerk_id = $1', [userId]);
    const user = userRes.rows[0];
    if (!user || user.role !== 'admin') {
      return new NextResponse("Forbidden: Admins only", { status: 403 });
    }

    if (notes !== undefined) {
      const existing = await client.query(
        `SELECT id FROM user_parcel_notes WHERE user_id = $1 AND parcel_key = $2`, [user.id, parcelKey]);
      if ((existing.rowCount ?? 0) > 0) {
        await client.query(`UPDATE user_parcel_notes SET content = $1, created_at = NOW() WHERE id = $2`, [notes, existing.rows[0].id]);
      } else if (String(notes).trim().length > 0) {
        await client.query(
          `INSERT INTO user_parcel_notes (user_id, parcel_key, content, created_at) VALUES ($1, $2, $3, NOW())`,
          [user.id, parcelKey, notes]);
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating parcel:', error);
    return new NextResponse("Internal Error", { status: 500 });
  } finally {
    client.release();
  }
}
