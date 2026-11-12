import LandingHeader from "@/components/landing/LandingHeader";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Refund Policy | Land Oracle",
  description: "Land Oracle refund policy: 7-day money-back guarantee on your first payment, monthly and annual plan terms, and how to request a refund.",
};

const H2 = "text-2xl font-semibold text-white mb-4";
const P = "text-slate-400 leading-relaxed";

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-950 font-sans selection:bg-blue-500/30">
      <LandingHeader />
      <div className="max-w-4xl mx-auto px-6 pt-32 pb-16">
        <h1 className="text-4xl font-bold text-white mb-8">Land Oracle Refund Policy</h1>
        <p className="text-slate-400 mb-8">Last updated: November 2026</p>

        <div className="space-y-8">
          <section>
            <h2 className={H2}>1. 7-day money-back guarantee (first payment only)</h2>
            <p className={P}>
              New subscribers can request a full refund within 7 days of their first payment, as long as they have exported fewer than 500
              rows. After 500 rows are exported, the first payment is non-refundable.
            </p>
          </section>

          <section>
            <h2 className={H2}>2. Monthly plans</h2>
            <p className={P}>
              Cancel anytime from your billing portal. You keep access until the end of the current billing period. No partial-month refunds.
            </p>
          </section>

          <section>
            <h2 className={H2}>3. Annual plans</h2>
            <p className={P}>
              Full refund within 14 days of the initial annual purchase, under the same export limit. After that, annual plans are
              non-refundable, but you can turn off auto-renewal anytime and keep access through the end of the term.
            </p>
          </section>

          <section>
            <h2 className={H2}>4. Founding Member pricing</h2>
            <p className={P}>
              The Founding Member discount stays as long as the subscription stays active. If you cancel, you lose the founding price, and
              resubscribing is at the regular rate.
            </p>
          </section>

          <section>
            <h2 className={H2}>5. Billing errors</h2>
            <p className={P}>
              Duplicate charges or billing mistakes are refunded in full, always.
            </p>
          </section>

          <section>
            <h2 className={H2}>6. Add-ons and credits</h2>
            <p className={P}>
              Used lookup credits are non-refundable. Unused credit packs can be refunded within 7 days of purchase.
            </p>
          </section>

          <section>
            <h2 className={H2}>7. How to request</h2>
            <p className={P}>
              Email <a href="mailto:support@landoracle.ai" className="text-blue-400 hover:text-blue-300 underline">support@landoracle.ai</a> from
              your account email. Refunds go back to the original payment method within 5–10 business days. Please contact us before
              disputing a charge with your bank. We’ll make it right faster.
            </p>
          </section>

          <p className="text-slate-500 text-sm pt-4 border-t border-slate-800">Billed by Fortune Oracle Media LLC.</p>
        </div>
      </div>
      <Footer />
    </main>
  );
}
