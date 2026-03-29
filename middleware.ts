import NextAuth from "next-auth";
import authConfig from "./auth.config";

// Middleware uses the edge-safe config (no prisma/libsql imports)
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/((?!_next|favicon\\.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
