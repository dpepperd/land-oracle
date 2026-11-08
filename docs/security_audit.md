# Land Oracle - Security Audit Checklist

**Project:** Land Oracle  
**Date:** January 23, 2026  
**Auditor:** Antigravity  
**Priority:** 🔴 CRITICAL - Must complete before production launch  
**Estimated Time:** 4-6 hours  

---

## Table of Contents

1. [SQL Injection Prevention](#1-sql-injection-prevention)
2. [Authentication Protection](#2-authentication-protection)
3. [Authorization & Tier Verification](#3-authorization--tier-verification)
4. [Input Validation](#4-input-validation)
5. [Database Connection Security](#5-database-connection-security)
6. [Error Handling](#6-error-handling)
7. [Environment Variables](#7-environment-variables)
8. [Rate Limiting](#8-rate-limiting)
9. [Output Sanitization](#9-output-sanitization)
10. [Testing Procedures](#10-testing-procedures)
11. [Deliverables](#11-deliverables)

---

## Priority Order

**Do First (CRITICAL):**
1. SQL Injection Prevention
2. Authentication Protection
3. Tier Verification

**Do Second (HIGH):**
4. Input Validation
5. Database Connection Security
6. Error Handling

**Do Third (MEDIUM):**
7. Environment Variables
8. Rate Limiting
9. Output Sanitization

---

## 1. SQL Injection Prevention

### 🔴 CRITICAL PRIORITY

### Objective
Verify ALL database queries use parameterized queries, never string concatenation or template literals.

### Files to Check
- [ ] All files in `/app/api/**/*` (API routes)
- [ ] All files in `/lib/**/*` that interact with database
- [ ] All files in `/scripts/**/*` (import/migration scripts)

### Search Commands

Run these commands to find dangerous patterns:

```bash
# Search for template literals in queries
grep -r "db.query.*\${" .
grep -r "pool.query.*\${" .
grep -r "db.query.*\`" .

# Search for string concatenation
grep -r "query.*\+" .
grep -r 'query.*".*\+' .
grep -r "query.*'.*\+" .
```

### ❌ WRONG - SQL Injection Vulnerable

```javascript
// DANGEROUS - DO NOT USE
const county = req.body.county
const query = `SELECT * FROM parcels WHERE county = '${county}'`
const result = await db.query(query)

// Attacker can send: county = "'; DROP TABLE parcels;--"
```

```javascript
// DANGEROUS - Template literal
const result = await db.query(`
  SELECT * FROM parcels 
  WHERE county = '${county}' 
    AND acreage >= ${acreage}
`)
```

```javascript
// DANGEROUS - String concatenation
const query = "SELECT * FROM parcels WHERE county = '" + county + "'"
const result = await db.query(query)
```

### ✅ CORRECT - Parameterized Queries

```javascript
// SAFE - Parameterized with $1, $2, etc.
const county = req.body.county
const result = await db.query(
  'SELECT * FROM parcels WHERE county = $1',
  [county]
)
```

```javascript
// SAFE - Multiple parameters
const result = await db.query(`
  SELECT * FROM parcels 
  WHERE county = $1 
    AND acreage >= $2 
    AND acreage <= $3
    AND owner_state = $4
`, [county, acreageMin, acreageMax, ownerState])
```

```javascript
// SAFE - Complex query with IN clause
const counties = ['Baker', 'Clay', 'Duval']
const placeholders = counties.map((_, i) => `$${i + 1}`).join(',')
const query = `SELECT * FROM parcels WHERE county IN (${placeholders})`
const result = await db.query(query, counties)
```

### Action Items

For EACH database query found:

- [ ] Verify it uses `$1, $2, $3...` parameter placeholders
- [ ] Verify parameters are passed as array in second argument
- [ ] Convert any string concatenation to parameterized queries
- [ ] Convert any template literals to parameterized queries
- [ ] Test the query still works after conversion

### Checklist

- [ ] All `/app/api` routes use parameterized queries
- [ ] All `/lib` database utilities use parameterized queries
- [ ] All import scripts use parameterized queries
- [ ] No grep results for dangerous patterns
- [ ] Tested sample queries work correctly

---

## 2. Authentication Protection

### 🔴 CRITICAL PRIORITY

### Objective
Verify ALL API routes require authentication and properly check for user ID.

### Files to Check
- [ ] `/app/api/search/route.js`
- [ ] `/app/api/export/route.js`
- [ ] `/app/api/crm/route.js` (if exists)
- [ ] `/app/api/usage/route.js` (if exists)
- [ ] Any other `/app/api/**/route.js` files

### ❌ WRONG - No Authentication

```javascript
// DANGEROUS - Anyone can access
export async function POST(request) {
  const body = await request.json()
  const results = await db.query('SELECT * FROM parcels WHERE county = $1', [body.county])
  return Response.json(results.rows)
}
```

### ✅ CORRECT - Authentication Required

```javascript
import { auth } from '@clerk/nextjs'

export async function POST(request) {
  const { userId } = auth()
  
  // Reject if not authenticated
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Continue with authenticated request
  const body = await request.json()
  const results = await db.query('SELECT * FROM parcels WHERE county = $1', [body.county])
  return Response.json(results.rows)
}
```

### Action Items

For EACH API route:

- [ ] Add `import { auth } from '@clerk/nextjs'` at top
- [ ] Add `const { userId } = auth()` at start of handler
- [ ] Add check: `if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })`
- [ ] Test that unauthenticated requests are rejected

### Public Routes Exception

Some routes may be intentionally public (health checks, webhooks):

```javascript
// These routes are OK without auth:
// - /api/health (health check endpoint)
// - /api/webhooks/stripe (Stripe webhook - has signature verification)
// - /api/webhooks/clerk (Clerk webhook - has signature verification)
```

### Checklist

- [ ] All search/query endpoints require auth
- [ ] All export endpoints require auth
- [ ] All CRM endpoints require auth
- [ ] All user data endpoints require auth
- [ ] Tested unauthenticated requests return 401
- [ ] Public routes documented with reason

---

## 3. Authorization & Tier Verification

### 🔴 CRITICAL PRIORITY

### Objective
Verify tier/permission checks happen SERVER-SIDE only. Never trust client-sent tier information.

### Files to Check
- [ ] All `/app/api/**/route.js` files that check tier
- [ ] Any code that validates feature access

### ❌ WRONG - Trusting Client Data

```javascript
// DANGEROUS - Client can fake tier
export async function POST(request) {
  const { userId } = auth()
  const body = await request.json()
  
  // ❌ Never trust client-sent tier!
  const tier = body.tier
  
  if (tier !== 'regional') {
    return Response.json({ error: 'Upgrade required' }, { status: 403 })
  }
  
  // User can easily bypass by sending tier: 'regional' in request
}
```

```javascript
// DANGEROUS - Client-sent isAdmin flag
if (body.isAdmin === true) {
  // Grant admin access ❌
}
```

### ✅ CORRECT - Server-Side Verification

```javascript
import { auth, clerkClient } from '@clerk/nextjs'

export async function POST(request) {
  const { userId } = auth()
  
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // ✅ Always fetch tier from Clerk server-side
  const user = await clerkClient.users.getUser(userId)
  const tier = user.publicMetadata?.tier || 'free'
  const isAdmin = user.publicMetadata?.is_admin === true
  
  // Admin bypass
  if (isAdmin) {
    // Admins can do anything
    return handleRequest(request)
  }
  
  // Check tier-based permissions
  if (tier !== 'regional' && tier !== 'enterprise') {
    return Response.json({ 
      error: 'This feature requires Regional tier or higher' 
    }, { status: 403 })
  }
  
  // Now we can trust the tier
  return handleRequest(request)
}
```

### Admin Bypass Pattern

```javascript
// Correct admin bypass implementation
const user = await clerkClient.users.getUser(userId)
const isAdmin = user.publicMetadata?.is_admin === true
const tier = user.publicMetadata?.tier || 'free'

// Admins skip all checks
if (isAdmin) {
  return handleAdminRequest(request)
}

// Regular users get tier-based access
const hasAccess = checkTierAccess(tier, requestedFeature)
if (!hasAccess) {
  return Response.json({ error: 'Upgrade required' }, { status: 403 })
}
```

### Action Items

For EACH API route that checks permissions:

- [ ] Remove any `body.tier` or `body.isAdmin` usage
- [ ] Add `clerkClient.users.getUser(userId)` call
- [ ] Extract tier from `user.publicMetadata?.tier`
- [ ] Extract admin from `user.publicMetadata?.is_admin`
- [ ] Implement admin bypass before tier checks
- [ ] Test that client can't fake tier
- [ ] Test that admin accounts bypass restrictions

### Search for Client-Sent Permissions

```bash
# Find potentially dangerous patterns
grep -r "body.tier" .
grep -r "body.isAdmin" .
grep -r "body.admin" .
grep -r "request.json().*tier" .
```

### Checklist

- [ ] No usage of client-sent tier values
- [ ] All tier checks use `clerkClient.users.getUser()`
- [ ] Admin bypass implemented correctly
- [ ] Tested user can't fake higher tier
- [ ] Tested admin can access all features
- [ ] No grep results for dangerous patterns

---

## 4. Input Validation

### 🟡 HIGH PRIORITY

### Objective
Validate all user inputs with Zod schemas before processing.

### Install Zod

```bash
npm install zod
```

### Files to Check
- [ ] All API routes that accept user input
- [ ] Especially: search, export, CRM endpoints

### ❌ WRONG - No Validation

```javascript
export async function POST(request) {
  const { userId } = auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  
  const body = await request.json()
  
  // ❌ Directly using unvalidated input
  const results = await db.query(
    'SELECT * FROM parcels WHERE county = $1 AND acreage >= $2',
    [body.county, body.acreageMin]
  )
  
  return Response.json(results.rows)
}
```

### ✅ CORRECT - Zod Validation

Create validation schemas:

```javascript
// lib/validation.js
import { z } from 'zod'

export const searchSchema = z.object({
  county: z.enum(['Baker', 'Clay', 'Duval', 'Nassau', 'St. Johns', 'Alachua', 'Columbia', 'Bradford', 'Putnam']),
  acreageMin: z.number().min(0).max(10000),
  acreageMax: z.number().min(0).max(10000),
  ownerState: z.string().length(2).optional(),
  landUse: z.array(z.string()).optional()
})

export const exportSchema = z.object({
  format: z.enum(['csv', 'excel', 'kml', 'geojson', 'shapefile']),
  parcelIds: z.array(z.string()).max(10000) // Prevent exporting millions
})

export const crmSchema = z.object({
  parcelId: z.string(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(), // E.164 format
  email: z.string().email().optional(),
  notes: z.string().max(5000), // Prevent massive text bombs
  leadStatus: z.enum(['contacted', 'interested', 'not_interested', 'deal_closed']).optional()
})
```

Use in API routes:

```javascript
import { searchSchema } from '@/lib/validation'

export async function POST(request) {
  const { userId } = auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    const body = await request.json()
    
    // ✅ Validate input with Zod
    const validatedData = searchSchema.parse(body)
    
    // Now use validated data (guaranteed to be correct type/format)
    const results = await db.query(
      'SELECT * FROM parcels WHERE county = $1 AND acreage >= $2',
      [validatedData.county, validatedData.acreageMin]
    )
    
    return Response.json(results.rows)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ 
        error: 'Invalid input',
        details: error.errors 
      }, { status: 400 })
    }
    
    console.error('Server error:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
```

### Validation Rules

**County Names:**
- Must be exact match from allowed list
- Prevents invalid county names
- Prevents SQL injection attempts

**Acreage:**
- Must be number (not string)
- Must be >= 0 (no negative values)
- Must be <= 10000 (prevent unrealistic values)

**Phone Numbers:**
- Optional field
- Must match E.164 format if provided
- Regex: `/^\+?[1-9]\d{1,14}$/`

**Email:**
- Optional field
- Must be valid email format
- Built-in Zod validator

**Notes:**
- Must be string
- Max 5000 characters (prevent abuse)

**Parcel IDs Array:**
- Must be array of strings
- Max 10,000 items (prevent memory issues)

### Action Items

- [ ] Create `/lib/validation.js` with schemas
- [ ] Add validation to search endpoint
- [ ] Add validation to export endpoint
- [ ] Add validation to CRM endpoint
- [ ] Test with invalid inputs (should reject with 400)
- [ ] Test with valid inputs (should work)

### Checklist

- [ ] All user inputs validated with Zod
- [ ] County names validated against allowed list
- [ ] Numeric fields validated for range
- [ ] String fields validated for max length
- [ ] Email/phone formats validated
- [ ] Array lengths limited
- [ ] Tested invalid inputs are rejected
- [ ] Tested valid inputs work correctly

---

## 5. Database Connection Security

### 🟡 HIGH PRIORITY

### Objective
Ensure database connection uses SSL and proper configuration.

### File to Check
- [ ] `/lib/db.js` (or wherever database connection is configured)

### ❌ WRONG - Insecure Connection

```javascript
import { Pool } from 'pg'

// DANGEROUS - No SSL, no connection limits
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false // ❌ Insecure!
})

export { pool as db }
```

```javascript
// DANGEROUS - Using Client instead of Pool
import { Client } from 'pg'

const client = new Client({
  connectionString: process.env.DATABASE_URL
})

await client.connect()
export { client as db }
```

### ✅ CORRECT - Secure Connection

```javascript
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  
  // ✅ Require SSL with valid certificate
  ssl: {
    rejectUnauthorized: true
  },
  
  // ✅ Connection pooling limits
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Fail fast if can't connect
  
  // ✅ Statement timeout
  statement_timeout: 10000 // Kill queries after 10 seconds
})

// Error handling
pool.on('error', (err) => {
  console.error('Unexpected database error:', err)
})

export { pool as db }
```

### SSL Configuration

**For Digital Ocean Managed Postgres:**
```javascript
ssl: {
  rejectUnauthorized: true,
  // Digital Ocean provides CA cert, but usually not needed
}
```

**For Self-Hosted Postgres:**
```javascript
ssl: {
  rejectUnauthorized: true,
  ca: fs.readFileSync('/path/to/ca-certificate.crt').toString(),
}
```

### Action Items

- [ ] Verify using `Pool` (not `Client`)
- [ ] Verify `ssl: { rejectUnauthorized: true }` is set
- [ ] Add connection pool limits (`max`, timeouts)
- [ ] Add error handler for pool
- [ ] Test connection works with SSL
- [ ] Verify DATABASE_URL includes `?sslmode=require` if needed

### Environment Variable Check

```bash
# DATABASE_URL should include SSL parameter
DATABASE_URL=postgresql://user:pass@host:25060/db?sslmode=require
```

### Checklist

- [ ] Using Pool (not Client)
- [ ] SSL enabled with `rejectUnauthorized: true`
- [ ] Connection pool limits configured
- [ ] Statement timeout configured
- [ ] Error handler added
- [ ] DATABASE_URL uses SSL
- [ ] Tested connection works

---

## 6. Error Handling

### 🟡 HIGH PRIORITY

### Objective
Never leak internal details (stack traces, database errors) to clients.

### Files to Check
- [ ] All `try/catch` blocks in API routes
- [ ] All error responses

### ❌ WRONG - Leaking Error Details

```javascript
try {
  const results = await db.query('SELECT * FROM parcels WHERE county = $1', [county])
  return Response.json(results.rows)
} catch (error) {
  // ❌ DANGEROUS - Sends full error to client
  return Response.json({ 
    error: error.message, // Could reveal DB structure
    stack: error.stack,   // Reveals code paths
    query: error.query    // Reveals SQL queries
  }, { status: 500 })
}
```

### ✅ CORRECT - Generic Error Messages

```javascript
try {
  const results = await db.query('SELECT * FROM parcels WHERE county = $1', [county])
  return Response.json(results.rows)
} catch (error) {
  // ✅ Log detailed error server-side
  console.error('Database error:', error)
  
  // ✅ Send generic message to client
  return Response.json({ 
    error: 'An error occurred while processing your request' 
  }, { status: 500 })
}
```

### Error Logging Best Practices

```javascript
try {
  // ... operation
} catch (error) {
  // Log with context for debugging
  console.error('Search API error:', {
    userId,
    county,
    errorMessage: error.message,
    errorStack: error.stack,
    timestamp: new Date().toISOString()
  })
  
  // Generic response
  return Response.json({ 
    error: 'Search failed. Please try again.' 
  }, { status: 500 })
}
```

### Validation Errors (Safe to Send Details)

```javascript
try {
  const validatedData = schema.parse(body)
  // ...
} catch (error) {
  if (error instanceof z.ZodError) {
    // ✅ Validation errors are safe to send to client
    return Response.json({ 
      error: 'Invalid input',
      details: error.errors // This is safe
    }, { status: 400 })
  }
  
  // Unknown errors get generic message
  console.error('Unexpected error:', error)
  return Response.json({ 
    error: 'An error occurred' 
  }, { status: 500 })
}
```

### Action Items

For EACH try/catch block:

- [ ] Remove `error.message` from client responses (except Zod)
- [ ] Remove `error.stack` from client responses
- [ ] Remove any `error.query` or DB details from responses
- [ ] Add `console.error()` for server-side logging
- [ ] Replace with generic "An error occurred" message
- [ ] Test that errors don't leak internal details

### Search for Error Leaks

```bash
# Find potentially dangerous error responses
grep -r "error.message" app/api/
grep -r "error.stack" app/api/
grep -r "error.query" app/api/
```

### Checklist

- [ ] All error responses use generic messages
- [ ] No `error.stack` sent to client
- [ ] No `error.message` sent to client (except validation)
- [ ] All errors logged server-side with context
- [ ] Validation errors separated from system errors
- [ ] No grep results for error leaks
- [ ] Tested errors return generic messages

---

## 7. Environment Variables

### 🔴 CRITICAL PRIORITY

### Objective
Ensure no secrets are committed to Git and all sensitive data is in environment variables.

### Files to Check
- [ ] `.gitignore`
- [ ] Git history
- [ ] All `.env*` files

### Check .gitignore

```bash
cat .gitignore | grep env
```

**Should include:**
```
.env
.env.local
.env*.local
.vercel
```

### Check Git History

```bash
# Search for any .env files ever committed
git log --all --full-history -- .env*

# Should return nothing
```

### ❌ DANGEROUS - Secrets in Code

```javascript
// NEVER DO THIS
const DATABASE_URL = "postgresql://admin:mypassword123@db.example.com:5432/landoracle"
const STRIPE_SECRET_KEY = "sk_live_EXAMPLE_PLACEHOLDER"
```

### ✅ CORRECT - Environment Variables

```javascript
// Always use environment variables
const DATABASE_URL = process.env.DATABASE_URL
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
```

### Environment Variable Checklist

**Development (`.env.local` - NOT in Git):**
```bash
DATABASE_URL=postgresql://dev_user:dev_pass@localhost:5432/landoracle_dev
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Production (Vercel Dashboard):**
- [ ] Set all variables in Vercel Settings > Environment Variables
- [ ] Verify names match exactly

### Action Items

- [ ] Verify `.gitignore` ignores all `.env*` but `.env.example`
- [ ] Search code for hardcoded secrets
- [ ] Verify all sensitive data is in `.env.local`
- [ ] Verify production env vars are set in deployment platform

### Checklist

- [ ] .gitignore is correct
- [ ] No env files in git history
- [ ] No hardcoded secrets in code (grep check)
- [ ] Production environment variables configured

---

## 8. Rate Limiting

### 🟡 MEDIUM PRIORITY

### Objective
Prevent abuse of API endpoints with rate limiting.

### Recommended Tool
`@upstash/ratelimit` or similar middleware.

---

## 9. Output Sanitization

### 🟡 MEDIUM PRIORITY

### Objective
Prevent XSS by sanitizing data before displaying in UI.

### React/Next.js Note
React automatically escapes content in JSX `{variable}`.
**Danger Zone**: `dangerouslySetInnerHTML`.

### Action Items
- [ ] Search for `dangerouslySetInnerHTML`
- [ ] Verify any usage is sanitized with `dompurify`

---

## 10. Testing Procedures

### SQL Injection Test
Attempt to inject SQL in search fields:
`Baker'; DROP TABLE parcels;--`
**Expected:** 0 results or generic error. **NOT** table deletion.

### Auth Test
Curl request to `/api/parcels/search` without headers.
**Expected:** 401 Unauthorized.

### Access Test
User with 'demo' tier trying to export.
**Expected:** 403 Forbidden.

---

## 11. Deliverables

1. **Updated Codebase** with security fixes.
2. **Verification Report** confirming all tests passed.
3. **Deployment Guide** with environment variable checklist.
