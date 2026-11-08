const { Client } = require('pg');
async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query("SELECT count(*) FROM parcels WHERE county = 'Saint Johns'");
  console.log('Saint Johns dbCount:', res.rows[0].count);
  await client.end();
}
check().catch(console.error);
