// Test-only preload: lets Next route handlers run under tsx (stubs next/headers + Clerk server import).
const Module = require('module');
const orig = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'next/headers') return { headers: async () => new Headers(globalThis.__reqHeaders || {}), cookies: async () => ({ get: () => undefined }) };
  if (req === '@clerk/nextjs/server') return {
    auth: async () => ({ userId: process.env.TEST_CLERK_ID || null }), currentUser: async () => null,
    clerkClient: async () => ({ users: { getUser: async () => ({ publicMetadata: {} }) } }),
  };
  return orig.call(this, req, ...rest);
};
