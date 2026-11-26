import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { finalizeCheckout } from '@/lib/checkout-finalize';
import AutoRefresh from './AutoRefresh';

export const dynamic = 'force-dynamic';

// Stripe sends the customer here after paying. We confirm the payment with Stripe and unlock the account right away,
// then forward to the dashboard. Outside /dashboard on purpose: that area is gated until the account is unlocked.
export default async function CheckoutSuccess({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/sign-in');
  const { session_id } = await searchParams;

  const result = await finalizeCheckout(
    pool,
    {
      getSession: (id) => stripe.checkout.sessions.retrieve(id),
      getSubscription: (id) => stripe.subscriptions.retrieve(id, { expand: ['items.data.price'] }),
    },
    session_id,
    user.id,
  );

  if (result.status === 'synced') redirect('/dashboard?checkout=success');

  const stuck = result.status === 'invalid' || result.status === 'error';
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4 text-center">
      <div className="max-w-md space-y-6">
        {stuck ? (
          <>
            <h1 className="text-3xl font-bold">We could not confirm your payment yet</h1>
            <p className="text-slate-300">
              If you were charged, your plan will turn on within a few minutes. You can also check your account or contact support.
            </p>
            <div className="flex flex-col items-center gap-3">
              <Link href="/dashboard" className="inline-block px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold">Go to dashboard</Link>
              <Link href="/contact" className="text-blue-400 hover:text-blue-300 underline underline-offset-4">Contact support</Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold">Payment received</h1>
            <p className="text-slate-300">Setting up your account. This takes a few seconds.</p>
            <AutoRefresh />
          </>
        )}
      </div>
    </div>
  );
}
