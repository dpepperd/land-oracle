// Deletes a user and everything of theirs, in one transaction, so the Clerk "user.deleted" webhook cannot fail halfway.
// leads and user_parcel_notes have foreign keys to users WITHOUT cascade and user_county_access has no foreign key, so they are removed explicitly.
// (export_usage, user_usage_searches and user_usage_exports cascade on their own; ai_usage is keyed by the Clerk id.)
import type { PoolClient } from 'pg';

export async function deleteUserAndData(client: PoolClient, clerkId: string): Promise<boolean> {
  await client.query('BEGIN');
  try {
    const u = (await client.query('SELECT id FROM users WHERE clerk_id = $1', [clerkId])).rows[0];
    if (!u) { await client.query('COMMIT'); return false; }
    await client.query('DELETE FROM user_parcel_notes WHERE user_id = $1', [u.id]);
    await client.query('DELETE FROM leads WHERE user_id = $1', [u.id]);
    await client.query('DELETE FROM user_county_access WHERE user_id = $1', [u.id]);
    await client.query('DELETE FROM ai_usage WHERE user_id = $1', [clerkId]);
    await client.query('DELETE FROM users WHERE id = $1', [u.id]);
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}
