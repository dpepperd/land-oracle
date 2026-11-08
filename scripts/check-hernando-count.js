const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
      const res = await client.query("SELECT count(*) FROM parcels WHERE county = 'Hernando'");
      console.log('Hernando Count:', res.rows[0].count);
      
      const res2 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Citrus'");
      console.log('Citrus Count:', res2.rows[0].count);

      const res3 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Levy'");
      console.log('Levy Count:', res3.rows[0].count);

      const res4 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Sarasota'");
      console.log('Sarasota Count:', res4.rows[0].count);
      const res5 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Dixie'");
      console.log('Dixie Count:', res5.rows[0].count);
      const res6 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Gilchrist'");
      console.log('Gilchrist Count:', res6.rows[0].count);
      const res7 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Columbia'");
      console.log('Columbia Count:', res7.rows[0].count);
      const res8 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Lafayette'");
      console.log('Lafayette Count:', res8.rows[0].count);
      const res9 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Suwannee'");
      console.log('Suwannee Count:', res9.rows[0].count);
      const res10 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Hamilton'");
      console.log('Hamilton Count:', res10.rows[0].count);
      const res11 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Taylor'");
      console.log('Taylor Count:', res11.rows[0].count);
      const res12 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Madison'");
      console.log('Madison Count:', res12.rows[0].count);
      const res13 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Jefferson'");
      console.log('Jefferson Count:', res13.rows[0].count);
      const res14 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Wakulla'");
      console.log('Wakulla Count:', res14.rows[0].count);
      const res15 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Leon'");
      console.log('Leon Count:', res15.rows[0].count);
      const res16 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Franklin'");
      console.log('Franklin Count:', res16.rows[0].count);
      const res17 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Liberty'");
      console.log('Liberty Count:', res17.rows[0].count);
      const res18 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Gadsden'");
      console.log('Gadsden Count:', res18.rows[0].count);
      const res19 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Gulf'");
      console.log('Gulf Count:', res19.rows[0].count);
      const res20 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Calhoun'");
      console.log('Calhoun Count:', res20.rows[0].count);
      const res21 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Jackson'");
      console.log('Jackson Count:', res21.rows[0].count);
      const res22 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Bay'");
      console.log('Bay Count:', res22.rows[0].count);
      const res23 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Escambia'");
      console.log('Escambia Count:', res23.rows[0].count);
      const res24 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Holmes'");
      console.log('Holmes Count:', res24.rows[0].count);
      const res25 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Washington'");
      console.log('Washington Count:', res25.rows[0].count);
      const res26 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Walton'");
      console.log('Walton Count:', res26.rows[0].count);
      const res27 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Bradford'");
      console.log('Bradford Count:', res27.rows[0].count);
      const res28 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Okaloosa'");
      console.log('Okaloosa Count:', res28.rows[0].count);
      const res29 = await client.query("SELECT count(*) FROM parcels WHERE county = 'Santa Rosa'");
      console.log('Santa Rosa Count:', res29.rows[0].count);
  } catch(e) { console.error(e); }
  finally {
    client.release();
    pool.end();
  }
}
run();
