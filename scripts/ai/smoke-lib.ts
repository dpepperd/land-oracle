// Smoke test of lib/parcels against the live DB (read-only). Usage:
//   npx tsx --require ./scripts/ai/clerk-stub.cjs scripts/ai/smoke-lib.ts [admin|free]
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });
(async () => {
  const { default: pool } = await import('../../lib/db');
  const P = await import('../../lib/parcels');
  const who = process.argv[2] || 'admin';
  const u = who === 'admin'
    ? (await pool.query("select clerk_id from users where role='admin' and clerk_id is not null limit 1")).rows[0]
    : (await pool.query("select u.clerk_id from users u where coalesce(u.role,'user')<>'admin' and u.clerk_id is not null limit 1")).rows[0];
  const uid = u.clerk_id as string;
  const t = async (name: string, fn: () => Promise<any>) => { const t0 = Date.now(); try { const r = await fn(); console.log('OK ', name, Date.now() - t0 + 'ms', JSON.stringify(r).slice(0, 600)); return r; } catch (e: any) { console.log('ERR', name, Date.now() - t0 + 'ms', e.name, e.message.slice(0, 200)); } };
  const s = await t('search Clay SFR 1-5ac', () => P.searchParcels(uid, { county: 'Clay', useCodes: ['001'], acreageMin: 1, acreageMax: 5, limit: 3 }));
  await t('search absentee jv>500k', () => P.searchParcels(uid, { county: 'Clay', absenteeOwner: true, jvMin: 500000, limit: 3 }));
  await t('search no sale 2y + flood AE', () => P.searchParcels(uid, { county: 'Clay', minYearsSinceLastSale: 2, floodZones: ['AE'], useCodes: ['001'], limit: 3 }));
  await t('search denied county (Leon)', () => P.searchParcels(uid, { county: 'Leon', limit: 1 }));
  const key = s?.rows?.[0]?.parcel_key;
  if (key) {
    await t('getParcel', () => P.getParcel(uid, key));
    await t('getComps', () => P.getComps(uid, key, { radiusMiles: 1, months: 24 }));
    await t('parcelContext', () => P.parcelContext(uid, key));
  }
  await t('getParcel bad key', () => P.getParcel(uid, 'nope'));
  await pool.end();
})();
