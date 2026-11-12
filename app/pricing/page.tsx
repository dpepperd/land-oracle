import PricingClient from './PricingClient';
import { getFoundingStatus } from '@/lib/founding';
import { aiEnabled } from '@/lib/plans';
import { capFor } from '@/lib/ai/usage';

export const dynamic = 'force-dynamic';   // founding status + AI flag are read at request time (Stripe lookup is cached 10 min)

export const metadata = {
  title: 'Pricing | Land Oracle',
  description: 'Florida parcel intelligence from 2026 county roll data. Pay only for the counties you need.',
};

export default async function PricingPage() {
  const founding = await getFoundingStatus();
  // Monthly AI question allowance per plan, read from the same setting the assistant enforces (so the page can never disagree with it)
  const aiQuestions = { pro: capFor('pro'), statewide: capFor('statewide') };
  return <PricingClient aiEnabled={aiEnabled()} founding={founding.available} aiQuestions={aiQuestions} />;
}
