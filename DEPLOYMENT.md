# Deployment Guide 🚀

## 1. Prepare for Production
We've cleaned up the code, but you should verify your `.env.local` keys are ready for production use (especially Stripe if you were using test keys, though for now we are using Clerk/Neon).

## 2. Push to GitHub
Since your project is not yet connected to a remote repository, follow these steps:

1.  Create a **New Repository** on GitHub (e.g., `land-oracle`).
2.  Run these commands in your terminal:
    ```bash
    git add .
    git commit -m "Ready for Vercel Deployment"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/land-oracle.git
    git push -u origin main
    ```

## 3. Deploy on Vercel
1.  Go to [Vercel Dashboard](https://vercel.com/dashboard).
2.  Click **Add New...** > **Project**.
3.  Import `land-oracle` from your GitHub.
4.  **Environment Variables**:
    You MUST copy these from your local `.env.local` to Vercel:
    *   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
    *   `CLERK_SECRET_KEY`
    *   `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
    *   `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
    *   `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
    *   `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`
    *   `DATABASE_URL` (Your Digital Ocean connection string)
    *   `CLERK_WEBHOOK_SECRET` (Generate this in Clerk Dashboard > Webhooks > Add Endpoint -> `https://your-vercel-app.vercel.app/api/webhooks/clerk`)

## 4. Run Database Migrations on Prod
Your Production Database is **Digital Ocean Managed Postgres**.
Since you are connecting to this same database from your local machine ("Dev"), **it is already migrated!** 
The tables (`users`, `parcels`, `user_county_access`) act as the single source of truth.

> **Important:** Vercel will connect to this same Digital Ocean database. Ensure your Digital Ocean "Trusted Sources" (if enabled) allow connections from Vercel (or "All IPv4" for simplicity during launch).

## 5. Verification
1.  Visit your live Vercel URL.
2.  **Log in** (or have Tatjana log in).
3.  Check the **County Picker** appears.
## 6. Private Beta (Admin Panel) 🛡️
I've built a **Control Center** so you don't have to edit code to approve users.

1.  **How it works:**
    *   **Public:** Can see Home, Pricing, About, Territories (View Only).
    *   **Sign Up:** Anyone can sign up (via Google).
    *   **The Guard:** By default, new users are **Blocked** from the Dashboard.
    *   **Admins:** You and Tatjana have full access and can see the Admin Panel.

2.  **To Approve a User:**
    1.  Go to `https://your-url.com/admin` (or `/admin` locally).
    2.  You will see a list of recent signups.
    3.  Click **"Blocked"** to toggle it to **"Approved"**.
    4.  That user can now access the dashboard immediately.

This gives you a live "Guest List" manager!

## 7. How to "Go Public" (Launch Day) 🚀
When you are ready to open the doors to everyone:

1.  Open `app/dashboard/layout.tsx`.
2.  Remove `await requireBetaAccess();`.
3.  Open `app/actions/territories.ts`.
4.  Remove `await requireBetaAccess();`.

That's it! The "Bouncer" is gone, and Clerk will continue to handle secure logins for all 8 billion people on Earth.
