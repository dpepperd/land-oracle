import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import pool from '@/lib/db';

const HARDCODED_ADMINS = [
  'dpepperd@gmail.com',
  'tatjanalovesfhrm@gmail.com'
];

export async function requireBetaAccess() {
  const user = await currentUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  const email = user.emailAddresses[0]?.emailAddress;
  
  // 1. Check Hardcoded List (Always allow Owners)
  if (email && HARDCODED_ADMINS.includes(email)) {
    return;
  }

  // 2. Check Database
  const client = await pool.connect();
  try {
      const res = await client.query(
          `SELECT beta_access, role FROM users WHERE clerk_id = $1`, 
          [user.id]
      );
      
      const dbUser = res.rows[0];
      
      if (!dbUser) {
          // User not in DB yet (Webhook delay?) -> Block
          console.log(`⛔ Access Denied (User not in DB): ${email}`);
          redirect('/access-denied');
      }

      if (dbUser.beta_access === true || dbUser.role === 'admin') {
          return; // Allow
      }
      
      console.log(`⛔ Access Denied (Not Beta): ${email}`);
      redirect('/access-denied');

  } finally {
      client.release();
  }
}

export async function requireAdmin() {
    const user = await currentUser();
    if (!user) redirect('/sign-in');
    
    // Check Hardcoded
    const email = user.emailAddresses[0]?.emailAddress;
    if (email && HARDCODED_ADMINS.includes(email)) return;

    // Check DB
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT role FROM users WHERE clerk_id = $1`, [user.id]);
        if (res.rows[0]?.role === 'admin') return;
    } finally {
        client.release();
    }
    
    redirect('/');
}

