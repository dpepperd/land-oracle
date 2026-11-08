const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const nullCounties = await client.query("SELECT count(*) FROM parcels WHERE county IS NULL OR county = ''");
  console.log('NULL or Empty counties:', nullCounties.rows[0].count);

  const weirdCounties = await client.query("SELECT DISTINCT county FROM parcels WHERE county NOT IN (SELECT county FROM parcels GROUP BY county HAVING count(*) > 5000)");
  console.log('Low-count counties (< 5000):', weirdCounties.rows);
  
  await client.end();
}
check().catch(console.error);
