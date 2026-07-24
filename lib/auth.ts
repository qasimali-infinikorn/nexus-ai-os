import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import {
  getMembership,
  getOrganizationById,
  getUserByEmail,
  getUserById,
  listMembershipsForUser
} from "./db/queries";
import { verifyPassword } from "./crypto";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1)
});

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
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
          isPlatformAdmin: user.isPlatformAdmin,
          sessionVersion: user.sessionVersion
        };
      }
    })
  ],
  callbacks: {
    // Runs on sign-in (when `user` is present), on session update (org switch),
    // and on token refresh. Org fields are only rewritten on sign-in / update.
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.userId = user.id;
        token.isPlatformAdmin = Boolean(user.isPlatformAdmin);
        token.sessionVersion =
          typeof (user as { sessionVersion?: number }).sessionVersion === "number"
            ? (user as { sessionVersion: number }).sessionVersion
            : 0;

        const memberships = await listMembershipsForUser(user.id);
        const primary = memberships[0];
        token.organizationId = primary?.organization.id ?? null;
        token.organizationName = primary?.organization.name ?? null;
        token.role = primary?.membership.role ?? null;
      } else if (token.userId) {
        const dbUser = await getUserById(token.userId);
        if (!dbUser || dbUser.sessionVersion !== (token.sessionVersion ?? 0)) {
          return {};
        }
      }

      if (trigger === "update" && token.userId) {
        if (session?.sessionVersion != null) {
          token.sessionVersion = Number(session.sessionVersion);
        }
        if (session?.organizationId) {
          const organizationId = String(session.organizationId);
          const membership = await getMembership(token.userId, organizationId);
          if (membership) {
            const org = await getOrganizationById(organizationId);
            if (org) {
              token.organizationId = org.id;
              token.organizationName = org.name;
              token.role = membership.role;
            }
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (!token.userId) {
        return { ...session, user: { ...session.user, id: "", isPlatformAdmin: false }, organizationId: null, organizationName: null, role: null };
      }
      if (token.userId) session.user.id = token.userId;
      session.user.isPlatformAdmin = Boolean(token.isPlatformAdmin);
      session.organizationId = token.organizationId ?? null;
      session.organizationName = token.organizationName ?? null;
      session.role = token.role ?? null;
      return session;
    }
  }
});
