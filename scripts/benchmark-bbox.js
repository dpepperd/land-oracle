const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function benchmark() {
  const client = await pool.connect();
  try {
    const box = { xmin: -81.7, ymin: 30.3, xmax: -81.6, ymax: 30.4 }; // Duval area
    const envelope = `ST_MakeEnvelope(${box.xmin}, ${box.ymin}, ${box.xmax}, ${box.ymax}, 4326)`;

    console.log('🏎️  Benchmarking BBOX (&&) vs Standard Intersects...');
    
    // 1. Standard Intersects
    const q1 = `
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT COUNT(*) FROM public.v_flood_hazard_map
      WHERE ST_Intersects(geometry, ${envelope});
    `;
    console.log('\n--- Scenario 1: ST_Intersects Only ---');
    const res1 = await client.query(q1);
    const plan1 = res1.rows.find(r => r['QUERY PLAN'].includes('Execution Time'));
    console.log(plan1 ? plan1['QUERY PLAN'] : 'No Execution Time found');

    // 2. BBOX + Intersects
    const q2 = `
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT COUNT(*) FROM public.v_flood_hazard_map
      WHERE geometry && ${envelope}
      AND ST_Intersects(geometry, ${envelope});
    `;
    console.log('\n--- Scenario 2: && (BBOX) + ST_Intersects ---');
    const res2 = await client.query(q2);
    const plan2 = res2.rows.find(r => r['QUERY PLAN'].includes('Execution Time'));
    console.log(plan2 ? plan2['QUERY PLAN'] : 'No Execution Time found');

  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
benchmark();
