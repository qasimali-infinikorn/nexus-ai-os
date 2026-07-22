#!/usr/bin/env node
/**
 * Grant or revoke Superadmin access for a user by email.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/grant-platform-admin.mjs you@example.com
 *   DATABASE_URL=... node scripts/grant-platform-admin.mjs you@example.com --revoke
 *
 * After granting, the user must sign out and back in so the JWT picks up
 * `isPlatformAdmin` (Auth.js credentials JWT is set at login).
 */
import postgres from "postgres";

const email = process.argv[2]?.trim().toLowerCase();
const revoke = process.argv.includes("--revoke");

if (!email || email.startsWith("-")) {
  console.error("Usage: node scripts/grant-platform-admin.mjs <email> [--revoke]");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false });

try {
  const rows = await sql`
    update users
    set is_platform_admin = ${!revoke}
    where email = ${email}
    returning id, email, name, is_platform_admin
  `;

  if (rows.length === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const user = rows[0];
  console.log(
    revoke
      ? `Revoked platform admin for ${user.email} (${user.name}).`
      : `Granted platform admin for ${user.email} (${user.name}). Sign out and back in to refresh the session.`
  );
} finally {
  await sql.end({ timeout: 5 });
}
