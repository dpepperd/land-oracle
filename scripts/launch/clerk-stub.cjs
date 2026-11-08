// Test-only: stubs @clerk/nextjs/server so route handlers can run under tsx. TEST_CLERK_ID selects the acting user.
const Module = require('module'); const orig = Module._load;
Module._load = function (req, ...rest) {
  if (req === '@clerk/nextjs/server') return {
    auth: async () => ({ userId: process.env.TEST_CLERK_ID || null }),
    currentUser: async () => null,
    clerkClient: async () => ({ users: { getUser: async () => ({ publicMetadata: {} }) } }),
    clerkMiddleware: () => () => {}, createRouteMatcher: () => () => false,
  };
  return orig.call(this, req, ...rest);
};
