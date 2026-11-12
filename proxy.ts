import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public PAGES (everything else under pages requires sign-in).
const isPublicPage = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/about(.*)",
  "/contact(.*)",
  "/terms(.*)",
  "/privacy(.*)",
  "/acceptable-use(.*)",
  "/data-disclaimer(.*)",
  "/refund-policy(.*)",
  "/territories(.*)",
  "/support(.*)",
  "/pricing(.*)"
]);

const isApiRoute = createRouteMatcher(["/api(.*)", "/trpc(.*)"]);

// API routes are PROTECTED BY DEFAULT. A new route is private unless it is
// explicitly listed here.
//  - webhooks verify their own signatures (svix / Stripe)
//  - flood / highways / stats serve only public reference data or county counts
const isPublicApi = createRouteMatcher([
  "/api/webhooks(.*)",
  "/api/map/flood",
  "/api/highways",
  "/api/parcels/stats",
  "/api/chat", // public site chatbot: static product facts only, no user data
]);

// The public /territories page reads the guest branch of this endpoint
// (returns a static county list, no database access for guests).
const isGuestReadableApi = (req: Request, pathname: string) =>
  req.method === "GET" && pathname === "/api/user/counties";

export default clerkMiddleware(async (auth, request) => {
  if (isApiRoute(request)) {
    if (isPublicApi(request) || isGuestReadableApi(request, request.nextUrl.pathname)) return;

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return;
  }

  if (!isPublicPage(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
