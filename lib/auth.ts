import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { getUserByEmail, listMembershipsForUser } from "./db/queries";
import { verifyPassword } from "./crypto";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1)
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // Required in environments (Vercel previews, local dev without AUTH_URL
  // set) where Auth.js can't otherwise verify the deployment's own host.
  trustHost: true,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await getUserByEmail(parsed.data.email);
        if (!user) return null;

        const passwordValid = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!passwordValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isPlatformAdmin: user.isPlatformAdmin
        };
      }
    })
  ],
  callbacks: {
    // Runs on sign-in (when `user` is present) and on every subsequent
    // request (token refresh) — only re-resolve the active org on sign-in,
    // not on every request, to keep this cheap.
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
        token.isPlatformAdmin = Boolean(user.isPlatformAdmin);

        const memberships = await listMembershipsForUser(user.id);
        // Phase 1: a user has exactly one org (created at signup or via
        // invitation acceptance), so "first membership" is unambiguous.
        // Org switching for multi-org users is a later-phase concern.
        const primary = memberships[0];
        token.organizationId = primary?.organization.id ?? null;
        token.organizationName = primary?.organization.name ?? null;
        token.role = primary?.membership.role ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId;
      session.user.isPlatformAdmin = Boolean(token.isPlatformAdmin);
      session.organizationId = token.organizationId ?? null;
      session.organizationName = token.organizationName ?? null;
      session.role = token.role ?? null;
      return session;
    }
  }
});
