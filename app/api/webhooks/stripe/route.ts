
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('Stripe-Signature') as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    console.error(`Webhook signature verification failed: ${error.message}`);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    
    const userId = session.metadata?.userId;
    const planType = session.metadata?.planType;
    const selectedCountiesJson = session.metadata?.selectedCounties;
    const subscriptionId = session.subscription;

    if (userId && planType) {
        console.log(`✅ Payment success for user ${userId}. Plan: ${planType}`);

        let quota = 0;
        let tier = 'demo';
        
        switch(planType) {
            case 'scout': quota = 1; tier = 'scout'; break;
            case 'local': quota = 3; tier = 'local'; break;
            case 'regional': quota = 15; tier = 'regional'; break;
            default: quota = 1; tier = 'scout';
        }

        const client = await pool.connect();
        try {
            let selectedCounties: string[] = [];
            try {
                selectedCounties = JSON.parse(selectedCountiesJson || '[]');
            } catch(e) { 
                console.error("Failed to parse selected counties", e);
            }

            // 1. Update User Tier & Quota
            await client.query(`
                INSERT INTO user_limits (user_id, tier, max_counties, used_counties, selected_counties, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (user_id) 
                DO UPDATE SET 
                    tier = EXCLUDED.tier,
                    max_counties = EXCLUDED.max_counties,
                    selected_counties = EXCLUDED.selected_counties,
                    used_counties = $4,
                    updated_at = NOW()
            `, [userId, tier, quota, selectedCounties.length, selectedCounties]);

            // 2. Log Transaction (Optional but good practice)
            // await client.query('INSERT INTO transactions ...')

            console.log(`Updated user ${userId} to ${tier} with ${selectedCounties.join(', ')}`);

        } catch (err) {
            console.error('Database update failed:', err);
            return new NextResponse('Database Error', { status: 500 });
        } finally {
            client.release();
        }
    }
  }

  return new NextResponse(null, { status: 200 });
}
