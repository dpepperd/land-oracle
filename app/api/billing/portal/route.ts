import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { auth, currentUser } from '@clerk/nextjs/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        const user = await currentUser();
        
        if (!userId || !user) return new NextResponse("Unauthorized", { status: 401 });

        const client = await pool.connect();
        let customerId: string | undefined;

        try {
            // Try to get stripe_customer_id
            const res = await client.query('SELECT stripe_customer_id FROM users WHERE clerk_id = $1', [userId]);
            customerId = res.rows[0]?.stripe_customer_id;
        } catch (e) {
            // Column might not exist, ignore and use callback
        } finally {
            client.release();
        }

        if (!customerId) {
            // Fallback: Search Stripe by Email
            const email = user.emailAddresses[0].emailAddress;
            const customers = await stripe.customers.list({ email: email, limit: 1 });
            if (customers.data.length > 0) {
                customerId = customers.data[0].id;
            }
        }

        if (!customerId) {
            return new NextResponse("No billing account found. Have you subscribed properly?", { status: 404 });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL}/support`,
        });

        return NextResponse.json({ url: session.url });
    } catch (err) {
        console.error("Billing Portal Error:", err);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
