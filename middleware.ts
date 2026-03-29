export { auth as middleware } from "./auth";

export const config = {
  matcher: [
    // Run middleware on all routes except static assets and Next.js internals
    "/((?!_next|favicon\\.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
