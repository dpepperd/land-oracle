// Single source of truth for "is this person an admin?".
//
// Admins are identified by EITHER:
//   1. Clerk publicMetadata.role === 'admin'   (set from the Clerk dashboard / API), or
//   2. a *verified* email listed in the ADMIN_EMAILS env var (comma-separated).
//
// No email addresses live in source code. Existing DB `users.role = 'admin'`
// rows continue to work (checked separately in auth-guard / API routes).

export function getAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** True if the (already-verified) email is on the ADMIN_EMAILS allowlist. */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmails().has(email.trim().toLowerCase());
}

type ClerkEmail = { emailAddress: string; verification?: { status?: string | null } | null };
type ClerkUserLike = {
  publicMetadata?: Record<string, unknown> | null;
  emailAddresses?: ClerkEmail[];
  primaryEmailAddress?: ClerkEmail | null;
};

/** Admin check for a Clerk backend `User` (e.g. from currentUser()). */
export function isClerkAdmin(user: ClerkUserLike | null | undefined): boolean {
  if (!user) return false;
  if (user.publicMetadata?.role === 'admin') return true;
  const primary = user.primaryEmailAddress ?? user.emailAddresses?.[0];
  // Only trust an email that Clerk has verified; otherwise anyone could sign
  // up with an admin's address.
  return primary?.verification?.status === 'verified' && isAdminEmail(primary.emailAddress);
}
