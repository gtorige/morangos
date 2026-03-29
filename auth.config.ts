import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";

// Edge-safe auth config — NO database imports, NO prisma
// The authorize function is a stub here; actual login happens via /api/login
export default {
  providers: [
    Credentials({
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      // This runs on server (Node.js), not edge. But we need the provider
      // declared here so NextAuth knows it exists for JWT/session handling.
      // The actual credential verification is done by /api/login route.
      authorize: () => null,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
  useSecureCookies: false,
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      const publicPaths = ["/login", "/setup", "/api/login", "/api/setup", "/api/auth"];
      if (publicPaths.some((p) => pathname.startsWith(p))) {
        return true;
      }

      if (!isLoggedIn) return false;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.email;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { username?: string }).username = token.username as string;
        (session.user as { isAdmin?: boolean }).isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
