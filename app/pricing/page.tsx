import PricingClient from './PricingClient';
import { getFoundingStatus } from '@/lib/founding';
import { aiEnabled } from '@/lib/plans';

export const dynamic = 'force-dynamic';   // founding status + AI flag are read at request time (Stripe lookup is cached 10 min)

export const metadata = {
  title: 'Pricing | Land Oracle',
  description: 'Florida parcel intelligence from 2026 county roll data. Pay only for the counties you need.',
};

export default async function PricingPage() {
  const founding = await getFoundingStatus();
  return <PricingClient aiEnabled={aiEnabled()} founding={founding.available} />;
}
