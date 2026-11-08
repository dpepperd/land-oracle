// Idempotently creates Land Oracle products, prices (lookup_key per price), coupon FOUNDING40 and its promotion code.
//   node scripts/stripe/setup-products.js            -> TEST mode only (refuses sk_live keys)
//   node scripts/stripe/setup-products.js --live     -> allows a live key (run this yourself)
// Reads STRIPE_SECRET_KEY from the environment (or .env.local). Safe to re-run: existing objects are reused;
// if a price amount changed, a new price is created and the lookup_key is transferred to it (old price stays, inactive for lookup).
const fs = require('fs'), path = require('path');
const envFile = path.join(__dirname, '..', '..', '.env.local');
if (fs.existsSync(envFile)) for (const l of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }
const Stripe = require('stripe');

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) { console.error('STRIPE_SECRET_KEY is not set.'); process.exit(1); }
const live = KEY.startsWith('sk_live') || KEY.startsWith('rk_live');
if (live && !process.argv.includes('--live')) { console.error('Refusing to run against a LIVE key without --live.'); process.exit(1); }
const stripe = new Stripe(KEY);

// Keep in sync with lib/plans.ts
const PRODUCTS = [
  { plan: 'scout',        name: 'Land Oracle Scout',     desc: '1 Florida county, 1,000 exports/month', monthly: 7900,  annual: 79000 },
  { plan: 'pro',          name: 'Land Oracle Pro',       desc: '3 Florida counties, unlimited exports, AI assistant', monthly: 19900, annual: 199000 },
  { plan: 'statewide',    name: 'Land Oracle Statewide', desc: 'All 67 Florida counties, unlimited exports, AI assistant', monthly: 44900, annual: 449000 },
  { plan: 'addon_county', name: 'Additional County',     desc: 'Extra county for Scout or Pro (quantity-based add-on)', monthly: 3900,  annual: 39000 },
];
const COUPON = { id: 'FOUNDING40', percent_off: 40, duration: 'forever', max_redemptions: 20, name: 'Founding Member 40% off' };

async function ensureProduct(p) {
  for await (const prod of stripe.products.list({ active: true, limit: 100 })) if (prod.metadata && prod.metadata.lo_plan === p.plan) return prod;
  const prod = await stripe.products.create({ name: p.name, description: p.desc, metadata: { lo_plan: p.plan } });
  console.log('  + product', p.plan, prod.id); return prod;
}
async function ensurePrice(product, key, interval, amount) {
  const found = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  const ex = found.data[0];
  if (ex && ex.unit_amount === amount && ex.recurring && ex.recurring.interval === interval && ex.product === product.id) { console.log('  = price', key, ex.id); return ex; }
  const price = await stripe.prices.create({
    product: product.id, currency: 'usd', unit_amount: amount, recurring: { interval }, lookup_key: key,
    transfer_lookup_key: !!ex, metadata: { lo_key: key },
  });
  console.log(ex ? '  ~ price (amount/interval changed, lookup_key transferred)' : '  + price', key, price.id, `$${amount / 100}/${interval}`); return price;
}

(async () => {
  console.log(`Stripe ${live ? 'LIVE' : 'TEST'} mode`);
  for (const p of PRODUCTS) {
    console.log(p.plan);
    const product = await ensureProduct(p);
    await ensurePrice(product, `${p.plan}_monthly`, 'month', p.monthly);
    await ensurePrice(product, `${p.plan}_annual`, 'year', p.annual);
  }
  let coupon;
  try { coupon = await stripe.coupons.retrieve(COUPON.id); console.log('= coupon', coupon.id, `${coupon.percent_off}% ${coupon.duration} max ${coupon.max_redemptions} used ${coupon.times_redeemed}`); }
  catch (e) { if (e.code !== 'resource_missing') throw e; coupon = await stripe.coupons.create(COUPON); console.log('+ coupon', coupon.id); }
  const codes = await stripe.promotionCodes.list({ code: 'FOUNDING40', limit: 1 });
  if (codes.data[0]) console.log('= promotion code FOUNDING40', codes.data[0].id, codes.data[0].active ? 'active' : 'INACTIVE');
  else { const pc = await stripe.promotionCodes.create({ promotion: { type: 'coupon', coupon: COUPON.id }, code: 'FOUNDING40' }); console.log('+ promotion code', pc.code, pc.id); }
  console.log('done');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
