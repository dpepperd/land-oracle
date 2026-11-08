// Creates an isolated, EMPTY schema `app_prod` for production user data plus a restricted role `landoracle_prod`.
//   node scripts/launch/make-prod-schema.js <path-to-write-prod-database-url>
// - Reads DATABASE_URL (admin) from .env.local. Does NOT modify or delete anything that exists in `public`.
// - App/user tables are recreated empty in app_prod (structure, indexes, constraints, FKs, own sequences).
// - landoracle_prod: full rights on app_prod, SELECT-only on parcel/reference tables in public, no access to public user tables.
// - The new role's password is written ONLY to the file given as the argument (never printed).
// - Single transaction: any failure rolls everything back. Refuses to run if app_prod or the role already exist.
const fs = require('fs'), crypto = require('crypto');
for (const l of fs.readFileSync(require('path').join(__dirname, '..', '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const out = process.argv[2]; if (!out) { console.error('usage: node make-prod-schema.js <output-file-for-prod-url>'); process.exit(1); }
const { Pool } = require('pg');
const adminUrl = process.env.DATABASE_URL;
const pool = new Pool({ connectionString: adminUrl.replace('?sslmode=require', '').replace('&sslmode=require', ''), ssl: { rejectUnauthorized: false } });

const APP_TABLES = ['users', 'stripe_events', 'user_county_access', 'leads', 'user_parcel_notes', 'user_usage_exports', 'user_usage_searches', 'export_usage', 'ai_usage', 'demo_sessions'];
const READ_ONLY = ['parcels', 'parcels_v2', 'flood_hazard', 'traffic_stats', 'spatial_ref_sys', 'highways', 'us_roads', 'interstates', 'county_codes', 'fema_bfe_cache', 'fema_flood_zone_cache',
  'parcel_sales_current', 'parcels_current_nogeom', 'parcels_current_all', 'parcels_current', 'v_flood_hazard_map', 'geography_columns', 'geometry_columns'];

(async () => {
  const c = await pool.connect();
  try {
    const exists = await c.query("select (select count(*) from pg_namespace where nspname='app_prod') s, (select count(*) from pg_roles where rolname='landoracle_prod') r");
    if (+exists.rows[0].s || +exists.rows[0].r) throw new Error('app_prod or landoracle_prod already exists; refusing to continue');
    await c.query('BEGIN');
    await c.query('CREATE SCHEMA app_prod');
    for (const t of APP_TABLES) await c.query(`CREATE TABLE app_prod.${t} (LIKE public.${t} INCLUDING ALL)`);
    // Give serial-style columns their own sequences (LIKE would otherwise keep nextval() on the public sequence).
    const defs = await c.query(`select c.relname t, a.attname col, pg_get_expr(d.adbin, d.adrelid) def
      from pg_attrdef d join pg_class c on c.oid=d.adrelid join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
      where n.nspname='app_prod' and pg_get_expr(d.adbin, d.adrelid) like 'nextval(%'`);
    for (const r of defs.rows) {
      const seq = `app_prod.${r.t}_${r.col}_seq`;
      const cur = await c.query(`select coalesce(max(${r.col}),0) m from public.${r.t}`); // NOT copied; production starts at 1
      await c.query(`CREATE SEQUENCE ${seq} OWNED BY app_prod.${r.t}.${r.col}`);
      await c.query(`ALTER TABLE app_prod.${r.t} ALTER COLUMN ${r.col} SET DEFAULT nextval('${seq}')`);
      void cur;
    }
    // Recreate foreign keys between the app tables (resolve to app_prod first).
    const fks = await c.query(`select conrelid::regclass::text tbl, conname, pg_get_constraintdef(oid) def from pg_constraint
      where contype='f' and conrelid = any($1::regclass[])`, [APP_TABLES.map((t) => `public.${t}`)]);
    await c.query('SET LOCAL search_path = app_prod, public');
    for (const f of fks.rows) await c.query(`ALTER TABLE app_prod.${f.tbl.replace(/^public\./, '')} ADD CONSTRAINT ${f.conname} ${f.def}`);
    await c.query('SET LOCAL search_path = public');

    const pw = crypto.randomBytes(24).toString('base64url');
    await c.query(`CREATE ROLE landoracle_prod LOGIN PASSWORD '${pw}'`);
    await c.query('GRANT USAGE ON SCHEMA app_prod TO landoracle_prod');
    await c.query('GRANT ALL ON ALL TABLES IN SCHEMA app_prod TO landoracle_prod');
    await c.query('GRANT ALL ON ALL SEQUENCES IN SCHEMA app_prod TO landoracle_prod');
    await c.query('GRANT USAGE ON SCHEMA public TO landoracle_prod');
    for (const t of READ_ONLY) { try { await c.query('SAVEPOINT g'); await c.query(`GRANT SELECT ON public.${t} TO landoracle_prod`); await c.query('RELEASE SAVEPOINT g'); } catch (e) { await c.query('ROLLBACK TO SAVEPOINT g'); console.log('  (skip grant, not found):', t); } }
    await c.query('ALTER ROLE landoracle_prod SET search_path = app_prod, public');
    await c.query('COMMIT');

    const u = new URL(adminUrl); u.username = 'landoracle_prod'; u.password = pw; u.searchParams.set('sslmode', 'require');
    fs.writeFileSync(out, u.toString() + '\n', { mode: 0o600 });
    console.log('OK: schema app_prod created with', APP_TABLES.length, 'empty tables;', fks.rowCount, 'foreign keys; role landoracle_prod created.');
    console.log('Production URL written to:', out, '(not printed)');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('FAILED, rolled back:', e.message); process.exitCode = 1;
  } finally { c.release(); await pool.end(); }
})();
