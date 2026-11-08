// Calls the real route handlers (search/export/notes/leads/[id]/stats) against the live DB with a stubbed Clerk user.
//   npx tsx --require ./scripts/launch/clerk-stub.cjs scripts/launch/route-smoke.ts
import path from 'path'; import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });
(async () => {
  const { default: pool } = await import('../../lib/db');
  const u = (await pool.query("select id, clerk_id from users where role='admin' and clerk_id is not null limit 1")).rows[0];
  process.env.TEST_CLERK_ID = u.clerk_id;
  const J = (b: any) => new Request('http://x/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
  const t = async (name: string, fn: () => Promise<any>) => { const t0 = Date.now(); try { const r = await fn(); console.log('OK ', name.padEnd(34), (Date.now() - t0) + 'ms', r); return r; } catch (e: any) { console.log('ERR', name.padEnd(34), e.message.slice(0, 160)); } };
  const search = (await import('../../app/api/parcels/search/route')).POST;
  const exportR = (await import('../../app/api/parcels/export/route')).POST;
  const s1 = await t('search Clay SFR', async () => { const r = await search(J({ counties: ['Clay'], landUse: ['001'], acreageMin: 1, acreageMax: 5, marketValueMin: 100000, marketValueMax: 900000, limit: 5 })); const j: any = await r.json(); return `${r.status} count=${j.count} key=${j.list?.[0]?.parcel_key} geom=${!!j.geojson?.features?.[0]?.geometry} err=${j.error || ''}`; });
  await t('search Clay address', async () => { const r = await search(J({ counties: ['Clay'], address: 'MAIN ST', limit: 5 })); const j: any = await r.json(); return `${r.status} count=${j.count} ${j.error || ''}`; });
  await t('search Clay parcelId', async () => { const r = await search(J({ counties: ['Clay'], parcelId: '21-05-25', limit: 5 })); const j: any = await r.json(); return `${r.status} count=${j.count} ${j.error || ''}`; });
  await t('search Volusia SFR', async () => { const r = await search(J({ counties: ['Volusia'], landUse: ['001'], marketValueMin: 300000, marketValueMax: 900000, acreageMin: 0, acreageMax: 5, limit: 5 })); const j: any = await r.json(); return `${r.status} count=${j.count} owner=${!!j.list?.[0]?.owner_name} ${j.error || ''}`; });
  await t('export Clay CSV', async () => { const r = await exportR(J({ counties: ['Clay'], landUse: ['001'], marketValueMin: 100000, marketValueMax: 900000, acreageMin: 1, acreageMax: 5 })); const txt = await r.text(); return `${r.status} lines=${txt.split('\n').length} head=${txt.split('\n')[0].slice(0, 80)}`; });
  const key = s1 ? (await (await search(J({ counties: ['Clay'], landUse: ['001'], limit: 1, marketValueMin: 100000, marketValueMax: 900000, acreageMin: 1, acreageMax: 5 }))).json() as any).list?.[0]?.parcel_key : null;
  if (key) {
    const save = (await import('../../app/api/notes/save/route')).POST;
    const getN = (await import('../../app/api/notes/[parcelId]/route')).GET;
    const lead = (await import('../../app/api/leads/create/route')).POST;
    const patch = (await import('../../app/api/parcels/[id]/route')).PATCH;
    await t('notes save', async () => (await save(J({ parcelKey: key, note: 'smoke-test-note' }))).status);
    await t('notes fetch', async () => { const r = await getN(new Request('http://x'), { params: Promise.resolve({ parcelId: key }) }); const j: any = await r.json(); return `${r.status} n=${j.notes?.length}`; });
    await t('lead create', async () => { const r = await lead(J({ parcel_key: key })); return `${r.status} ${JSON.stringify(await r.json())}`; });
    await t('search is_lead/has_note flags', async () => { const r = await search(J({ counties: ['Clay'], parcelId: key.split('-').slice(2).join('-').slice(0, 14), limit: 3 })); const j: any = await r.json(); const x = j.list?.find((p: any) => p.parcel_key === key); return `lead=${x?.is_lead} note=${x?.has_note}`; });
    await t('PATCH owner edit -> 403', async () => (await patch(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ owner_name: 'X' }) }), { params: Promise.resolve({ id: key }) })).status);
    await pool.query("delete from user_parcel_notes where parcel_key=$1 and content='smoke-test-note'", [key]);
    await pool.query('delete from leads where parcel_key=$1 and user_id=$2', [key, u.id]);
  }
  const stats = (await import('../../app/api/parcels/stats/route')).GET;
  await t('stats', async () => { const r = await stats(); const j: any = await r.json(); return `${r.status} counties=${Object.keys(j).length} clay=${j.Clay}`; });
  await pool.end();
})();
