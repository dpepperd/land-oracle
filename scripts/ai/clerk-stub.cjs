// Test-only: lets lib/parcels run outside Next by stubbing the Clerk server import (no auth bypass in app code).
const Module = require('module');
const orig = Module._load;
Module._load = function (req, ...rest) {
  if (req === '@clerk/nextjs/server') return { clerkClient: async () => ({ users: { getUser: async () => ({ publicMetadata: {} }) } }), auth: async () => ({ userId: null }), currentUser: async () => null };
  return orig.call(this, req, ...rest);
};
