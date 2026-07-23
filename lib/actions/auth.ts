"use server";

import { z } from "zod";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn, signOut } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";
import { createUserAndOrg, getUserByEmail } from "@/lib/db/queries";
import {
  assertLoginAttemptAllowed,
  getClientKeyFromHeaders,
  recordFailedLoginAttempt
} from "@/lib/rate-limit";

export type FormState = { error?: string } | undefined;

// Only ever redirect to a same-app relative path (never an absolute
// URL/protocol-relative one) — this value comes from an unauthenticated
// query param, so treat it as untrusted input.
function safeRedirectTarget(value: FormDataEntryValue | null): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/dashboard";
}

const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required.")
});

const LOGIN_LOCKED_MESSAGE = "Too many sign-in attempts. Try again in a few minutes.";

export async function loginAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const ip = getClientKeyFromHeaders(await headers());
  const email = parsed.data.email;
  if (!assertLoginAttemptAllowed(ip, email).ok) {
    return { error: LOGIN_LOCKED_MESSAGE };
  }

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo: safeRedirectTarget(formData.get("from"))
    });
  } catch (error) {
    if (error instanceof AuthError) {
      recordFailedLoginAttempt(ip, email);
      return { error: "Invalid email or password." };
    }
    // signIn() redirects on success by throwing a Next.js redirect signal —
    // let that propagate rather than swallowing it as a form error.
    throw error;
  }

  return undefined;
}

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  organizationName: z.string().trim().min(2, "Organization name must be at least 2 characters."),
  email: z.email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[a-zA-Z]/, "Password must contain a letter.")
    .regex(/[0-9]/, "Password must contain a number.")
});

export async function signupAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    organizationName: formData.get("organizationName"),
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const existing = await getUserByEmail(parsed.data.email);
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await createUserAndOrg({
    email: parsed.data.email,
    name: parsed.data.name,
    passwordHash,
    organizationName: parsed.data.organizationName
  });

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeRedirectTarget(formData.get("from"))
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created, but sign-in failed. Try logging in." };
    }
    throw error;
  }

  return undefined;
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
