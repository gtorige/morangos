import NextAuth from "next-auth";
import authConfig from "./auth.config";

// Full auth config with all callbacks — used by API routes (Node.js runtime)
// The middleware uses auth.config.ts directly (Edge-safe, no prisma)
export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
