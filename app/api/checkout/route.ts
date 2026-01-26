import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { auth, currentUser } from '@clerk/nextjs/server';

// PLAN CONFIGURATION (You should sync these Price IDs with your Stripe Dashboard)
// For now, we mistakenly use hardcoded amounts if Price IDs aren't ready, 
// BUT typically you use price_123 or just pass line_items with custom amount (not recommended for subs).
// Best Practice: Create Products in Stripe and use their API IDs. 
// For this 'Painless' setup, we can use inline price data if we want, but Subscriptions REQUIRE Price IDs.
// We will assume environment variables for Price IDs or fallback to generic logic if needed.

// MOCK PRICE IDs for now - User must populate these in .env later
// STRIPE_PRICE_SCOUT_MONTHLY
// STRIPE_PRICE_LOCAL_MONTHLY
// STRIPE_PRICE_REGIONAL_MONTHLY

const PLANS = {
    1: { name: 'Scout', priceId: process.env.STRIPE_PRICE_SCOUT_MONTHLY, quota: 1 },
    3: { name: 'Local', priceId: process.env.STRIPE_PRICE_LOCAL_MONTHLY, quota: 3 },
    regional: { name: 'Regional', priceId: process.env.STRIPE_PRICE_REGIONAL_MONTHLY, quota: 15 } // 15 is placeholder for region
};

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        const user = await currentUser();
        
        if (!userId || !user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { counties, planType } = body; // planType: 'scout', 'scout_plus', 'local', 'local_plus', 'regional'

        if (!counties || counties.length === 0) {
            return new NextResponse("No counties selected", { status: 400 });
        }

        const line_items = [];
        const count = counties.length;

        // Pricing Logic Construction
        if (planType.includes('scout')) {
            // Base Scout
             line_items.push({ price: process.env.STRIPE_PRICE_SCOUT_MONTHLY, quantity: 1 });
             // Add-ons
             if (count > 1) {
                const addons = count - 1;
                line_items.push({ price: process.env.STRIPE_PRICE_ADDON_MONTHLY, quantity: addons });
             }
        } 
        else if (planType.includes('local')) {
            // Base Local
            line_items.push({ price: process.env.STRIPE_PRICE_LOCAL_MONTHLY, quantity: 1 });
            // Add-ons (Over 3)
            if (count > 3) {
                const addons = count - 3;
                line_items.push({ price: process.env.STRIPE_PRICE_ADDON_MONTHLY, quantity: addons });
            }
        }
        else if (planType === 'regional') {
             line_items.push({ price: process.env.STRIPE_PRICE_REGIONAL_MONTHLY, quantity: 1 });
        }

        const session = await stripe.checkout.sessions.create({
            customer_email: user.emailAddresses[0].emailAddress,
            line_items: line_items,
            mode: 'subscription',
            allow_promotion_codes: true,
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/territories`,
            metadata: {
                userId: userId,
                planType: planType,
                selectedCounties: JSON.stringify(counties),
            },
            subscription_data: {
                metadata: {
                    userId: userId,
                    planType: planType
                }
            }
        });

        return NextResponse.json({ url: session.url });

    } catch (error) {
        console.error("Stripe Checkout Error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
