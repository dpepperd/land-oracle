# Go-Live Checklist

Do these in order. Production currently holds test-mode Stripe values for `STRIPE_WEBHOOK_SECRET`; that must be replaced before launch.

- [ ] **Replace production `STRIPE_SECRET_KEY`** with the live-mode key (`sk_live_...`). Vercel > Project > Settings > Environment Variables > Production.
- [ ] **Create the live webhook endpoint** in Stripe (live mode): `https://<production-domain>/api/webhooks/stripe`, events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- [ ] **Replace production `STRIPE_WEBHOOK_SECRET`** with the live endpoint's signing secret (`whsec_...`).
- [ ] **Run `node scripts/stripe/setup-products.js --live`** with the live key in `STRIPE_SECRET_KEY` (creates products, `lookup_key` prices and the `FOUNDING40` coupon/promo code in live mode). Safe to re-run.
- [ ] **Set `CLERK_WEBHOOK_SECRET`** (Production): Clerk dashboard > Webhooks > endpoint `https://<production-domain>/api/webhooks/clerk` (`user.created`, `user.updated`, `user.deleted`).
- [ ] **Set `ADMIN_EMAILS`** (Production): comma-separated verified emails that get admin.
- [ ] **Redeploy production** so the new env vars take effect (Vercel only applies env changes to new deployments).
- [ ] Verify: `/pricing` shows the founding banner, a live-mode checkout completes, and the Stripe webhook delivery shows 200.

See `.env.example` for variable descriptions.
