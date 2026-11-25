// Counts searches per account per day (user_usage_searches), to back the refund policy's "substantially used" clause and to show in the admin panel.
// Records only: it never blocks or slows a search. A failure here is logged and ignored.
import pool from '@/lib/db';

export function countSearch(clerkId: string): void {
  pool.query(
    `INSERT INTO user_usage_searches (user_id, date, count)
     SELECT id, CURRENT_DATE, 1 FROM users WHERE clerk_id = $1
     ON CONFLICT (user_id, date) DO UPDATE SET count = user_usage_searches.count + 1`,
    [clerkId],
  ).catch((e: Error) => console.error('[searchCounter] could not count search:', e.message));
}
