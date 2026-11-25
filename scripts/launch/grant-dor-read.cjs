// The production role (landoracle_prod) needs read access to dor.nal_2026: Florida search by parcel id / address, parcel detail and export read it.
// Without this, production logs "permission denied for schema dor". Read-only, one table. Safe to re-run.
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
(async () => {
  const p = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });
  try {
    await p.query('GRANT USAGE ON SCHEMA dor TO landoracle_prod');
    await p.query('GRANT SELECT ON dor.nal_2026 TO landoracle_prod');
    const r = await p.query("select has_schema_privilege('landoracle_prod','dor','USAGE') usage, has_table_privilege('landoracle_prod','dor.nal_2026','SELECT') sel, has_table_privilege('landoracle_prod','dor.nal_2026','INSERT') ins");
    console.log(r.rows[0]);
  } catch (e) { console.error(e.message); process.exitCode = 1; } finally { await p.end(); }
})();
