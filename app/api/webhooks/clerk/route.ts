import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import pool from '@/lib/db'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400
    })
  }

  // Get the ID and type
  const eventType = evt.type;

  if (eventType === 'user.created') {
    const { id, email_addresses } = evt.data;
    const email = email_addresses?.[0]?.email_address;
    
    const role = email === 'tatjanalovesfhrm@gmail.com' ? 'admin' : 'user';
    
    // Insert into DB
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO users (clerk_id, email, subscription_tier, subscription_status, role)
            VALUES ($1, $2, 'demo', 'active', $3)
            ON CONFLICT (clerk_id) DO UPDATE SET role = EXCLUDED.role WHERE users.email = 'tatjanalovesfhrm@gmail.com'
        `, [id, email, role]);
        console.log(`User created: ${id} as ${role}`);
    } catch (e) {
        console.error('Error creating user in DB:', e);
        return new Response('Error inserting user', { status: 500 });
    } finally {
        client.release();
    }
  }

  if (eventType === 'user.updated') {
    const { id, email_addresses } = evt.data;
    const email = email_addresses?.[0]?.email_address;

    const client = await pool.connect();
    try {
        await client.query(`
            UPDATE users SET email = $2 WHERE clerk_id = $1
        `, [id, email]);
        console.log(`User updated: ${id}`);
    } catch (e) {
        console.error('Error updating user in DB:', e);
        return new Response('Error updating user', { status: 500 });
    } finally {
        client.release();
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;

    const client = await pool.connect();
    try {
        // ON DELETE CASCADE on user_county_access will handle the rest if we drop the user.
        await client.query(`DELETE FROM users WHERE clerk_id = $1`, [id || '']);
        console.log(`User deleted: ${id}`);
    } catch (e) {
        console.error('Error deleting user from DB:', e);
        return new Response('Error deleting user', { status: 500 });
    } finally {
        client.release();
    }
  }

  return new Response('', { status: 200 })
}
