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
    // 1. Check Admin Role
    const userRes = await client.query('SELECT role FROM users WHERE clerk_id = $1', [userId]);
    const userRole = userRes.rows[0]?.role;

    if (userRole !== 'admin') {
      return new NextResponse("Forbidden: Admins only", { status: 403 });
    }

    // 2. Update Parcel
    await client.query(`
        UPDATE parcels 
        SET phone_number = $1, notes = $2, owner_name = $3, email = $4, phone_verified = $5, email_verified = $6
        WHERE parcel_id = $7
    `, [phone_number, notes, owner_name, email, phone_verified || false, email_verified || false, id]);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating parcel:', error);
    return new NextResponse("Internal Error", { status: 500 });
  } finally {
    client.release();
  }
}
