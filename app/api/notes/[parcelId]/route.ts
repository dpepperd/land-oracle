import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';

export async function GET(req: Request, { params }: { params: { parcelId: string } }) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const client = await pool.connect();
  try {
    const { parcelId } = await params;
    
    // 1. Identify User Role & ID
    const userRes = await client.query('SELECT id, role FROM users WHERE clerk_id = $1', [userId]);
    const user = userRes.rows[0];
    
    if (!user) return new NextResponse("User not found", { status: 404 });

    // 2. Query Logic (Admin Mode vs Personal Mode)
    let query, values;
    
    if (user.role === 'admin') {
        // Admins see notes from ALL admins + timeline
        query = `
            SELECT n.id, n.content, n.created_at, u.email as author 
            FROM user_parcel_notes n
            JOIN users u ON n.user_id = u.id
            WHERE n.parcel_id = $1 AND u.role = 'admin'
            ORDER BY n.created_at DESC
        `;
        values = [parcelId];
    } else {
        // Users see ONLY their own notes history
        query = `
            SELECT id, content, created_at 
            FROM user_parcel_notes 
            WHERE user_id = $1 AND parcel_id = $2
            ORDER BY created_at DESC
        `;
        values = [user.id, parcelId];
    }

    const noteRes = await client.query(query, values);
    // const noteData = noteRes.rows[0]; // Not used? we return list below

    return NextResponse.json({ 
        notes: noteRes.rows.map(row => ({
            id: row.id, 
            note: row.content, // Map 'content' back to 'note' for Frontend compatibility
            created_at: row.created_at,
            author: row.author || 'me'
        }))
    });

  } catch (error) {
    console.error('Fetch Note Error:', error);
    return new NextResponse("Internal Error", { status: 500 });
  } finally {
    client.release();
  }
}
