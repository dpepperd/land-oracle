import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> } // Params are now Promises in Next.js 15+
) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const { phone_number, notes, owner_name, email, phone_verified, email_verified } = await req.json();

  const client = await pool.connect();
  try {
    // 1. Check Admin Role & Get User ID
    const userRes = await client.query('SELECT id, role FROM users WHERE clerk_id = $1', [userId]);
    const user = userRes.rows[0];

    if (!user || user.role !== 'admin') {
      return new NextResponse("Forbidden: Admins only", { status: 403 });
    }

    // 2. Update Parcel Data (Owner & Contact Info)
    await client.query(`
        UPDATE parcels 
        SET 
          own_name = $1, 
          phone_number = $2, 
          email = $3, 
          phone_verified = $4, 
          email_verified = $5
        WHERE parcelno = $6
    `, [owner_name, phone_number, email, phone_verified || false, email_verified || false, id]);

    // 3. Upsert Note (if provided)
    if (notes !== undefined) {
      // Check if note exists for this user/parcel
      const existingNote = await client.query(`
          SELECT id FROM user_parcel_notes 
          WHERE user_id = $1 AND parcel_id = $2
      `, [user.id, id]);

      if ((existingNote.rowCount ?? 0) > 0) {
          // Update
          await client.query(`
              UPDATE user_parcel_notes 
              SET content = $1, created_at = NOW()
              WHERE id = $2
          `, [notes, existingNote.rows[0].id]);
      } else {
          // Insert
          if (notes.trim().length > 0) {
              await client.query(`
                  INSERT INTO user_parcel_notes (user_id, parcel_id, content, created_at)
                  VALUES ($1, $2, $3, NOW())
              `, [user.id, id, notes]);
          }
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
