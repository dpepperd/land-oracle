const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function verifyMapQueries() {
  const client = await pool.connect();
  try {
    console.log('🌍 Verifying Map Queries for User Checklist...');

    // A) Data in Viewport (Duval Area)
    console.log('\n--- Checklist A: Data in Viewport (BBOX Check) ---');
    // Using Duval coordinates roughly: -82.0, 30.0 to -81.5, 30.5
    const q1 = `
      SELECT COUNT(*) 
      FROM public.v_flood_hazard_map
      WHERE geometry && ST_MakeEnvelope(-82.0, 30.0, -81.5, 30.5, 4326);
    `;
    const res1 = await client.query(q1);
    const count1 = parseInt(res1.rows[0].count);
    console.log(`[Query A] Row Count: ${count1} (Expected > 0) -> ${count1 > 0 ? '✅ PASS' : '❌ FAIL'}`);

    // B) Point-in-Polygon
    console.log('\n--- Checklist B: Point-in-Polygon (Specific Lat/Lon) ---');
    // Point: -81.6557, 30.3322 (Jacksonville)
    const q2 = `
      SELECT FLD_ZONE, SFHA_TF 
      FROM public.v_flood_hazard_map
      WHERE ST_Intersects(
        geometry,
        ST_SetSRID(ST_Point(-81.6557, 30.3322), 4326)
      )
      LIMIT 5;
    `;
    const res2 = await client.query(q2);
    console.log(`[Query B] Rows Found: ${res2.rows.length}`);
    if (res2.rows.length > 0) {
      console.log('Result Sample:', res2.rows[0]);
      console.log('✅ PASS: Point intersects with flood zone.');
    } else {
      console.log('❌ FAIL: No intersection found at this point (Check coordinate).');
    }

    // C) Source Name Check (Bonus)
    const q3 = `SELECT DISTINCT source_name FROM public.v_flood_hazard_map LIMIT 5;`;
    const res3 = await client.query(q3);
    console.log(`\n[Bonus] Source Names: ${res3.rows.map(r => r.source_name).join(', ')}`);

  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    client.release();
    pool.end();
  }
}
verifyMapQueries();
