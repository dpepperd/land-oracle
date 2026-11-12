// Test-only: like clerk-stub.cjs but auth() returns the user in env TEST_CLERK_ID (or null when unset), so route handlers can be run outside Next.
const Module = require('module');
const orig = Module._load;
Module._load = function (req, ...rest) {
  if (req === '@clerk/nextjs/server') {
    return {
      clerkClient: async () => ({ users: { getUser: async () => ({ publicMetadata: {} }) } }),
      auth: async () => ({ userId: process.env.TEST_CLERK_ID || null }),
      currentUser: async () => null,
    };
  }
  return orig.call(this, req, ...rest);
};
