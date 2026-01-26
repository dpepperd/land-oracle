import { Pool } from 'pg';

// Use the DATABASE_URL from environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace('?sslmode=require', '').replace('&sslmode=require', '') : undefined,
  ssl: { rejectUnauthorized: false }
});

export default pool;
