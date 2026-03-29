import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Usuário", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.usuario.findUnique({
          where: { username: credentials.username as string },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.senha
        );

        if (!valid) return null;

        return {
          id: String(user.id),
          name: user.nome,
          email: user.username,
          isAdmin: user.isAdmin,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  useSecureCookies: false,
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      // Public paths — no auth required
      const publicPaths = ["/login", "/setup", "/api/login", "/api/setup", "/api/auth"];
      if (publicPaths.some((p) => pathname.startsWith(p))) {
        return true;
      }

      // Redirect unauthenticated users to login
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
});
