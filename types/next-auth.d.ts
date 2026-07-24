import type { MembershipRole } from "@/lib/db/schema";

// Augments Auth.js's built-in types with the fields lib/auth.ts's jwt/session
// callbacks actually populate — the active organization, membership role,
// and platform-admin flag. See docs/AUTH.md for the org-selection model.
//
// These target "@auth/core/types" and "@auth/core/jwt", NOT "next-auth" and
// "next-auth/jwt" — next-auth's own .d.ts files only *re-export* Session/
// User/JWT from @auth/core (`export type {...} from "@auth/core/types"`),
// and TS module augmentation only merges with the module that actually
// declares the interface. Augmenting "next-auth" directly compiles without
// error but silently has no effect, leaving these fields typed as missing.
declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      isPlatformAdmin: boolean;
    };
    organizationId: string | null;
    organizationName: string | null;
    role: MembershipRole | null;
    /** Passed through `unstable_update` after bumping users.session_version. */
    sessionVersion?: number;
  }

  interface User {
    id: string;
    isPlatformAdmin?: boolean;
    sessionVersion?: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    isPlatformAdmin?: boolean;
    organizationId?: string | null;
    organizationName?: string | null;
    role?: MembershipRole | null;
    sessionVersion?: number;
  }
}
