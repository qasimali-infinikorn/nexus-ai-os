"use server";

import { z } from "zod";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signIn, signOut, unstable_update, auth } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";
import {
  createPasswordResetToken,
  createUserAndOrg,
  getMembership,
  getOrganizationById,
  getPasswordResetByToken,
  getUserByEmail,
  consumePasswordResetToken,
  writeAuditLog
} from "@/lib/db/queries";
import {
  assertLoginAttemptAllowed,
  assertPasswordResetAllowed,
  getClientKeyFromHeaders,
  recordFailedLoginAttempt,
  recordPasswordResetRequest
} from "@/lib/rate-limit";

export type FormState = { error?: string; success?: string } | undefined;

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

const forgotSchema = z.object({
  email: z.email("Enter a valid email address.")
});

const FORGOT_GENERIC_SUCCESS =
  "If an account exists for that email, we sent a reset link. Check your inbox.";

export async function requestPasswordResetAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const ip = getClientKeyFromHeaders(await headers());
  const email = parsed.data.email;
  if (!assertPasswordResetAllowed(ip, email).ok) {
    return { error: "Too many reset requests. Try again in an hour." };
  }
  recordPasswordResetRequest(ip, email);

  const user = await getUserByEmail(email);
  if (user) {
    const { token } = await createPasswordResetToken(user.id);
    const { sendPasswordResetEmail } = await import("@/lib/notifications/deliver");
    await sendPasswordResetEmail({
      to: user.email,
      resetPath: `/reset-password/${token}`
    });
    await writeAuditLog({
      organizationId: null,
      actorUserId: user.id,
      action: "user.password_reset_requested",
      targetType: "user",
      targetId: user.id
    });
  }

  // Always the same message — don't leak whether the email is registered.
  return { success: FORGOT_GENERIC_SUCCESS };
}

const resetPasswordSchema = z.object({
  token: z.string().min(20, "Invalid or expired reset link."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[a-zA-Z]/, "Password must contain a letter.")
    .regex(/[0-9]/, "Password must contain a number."),
  confirmPassword: z.string().min(1, "Confirm your password.")
}).refine((v) => v.password === v.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"]
});

export async function resetPasswordAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const existing = await getPasswordResetByToken(parsed.data.token);
  if (!existing || existing.usedAt || existing.expiresAt < new Date()) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const consumed = await consumePasswordResetToken({
    token: parsed.data.token,
    passwordHash
  });
  if (!consumed) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  await writeAuditLog({
    organizationId: null,
    actorUserId: consumed.userId,
    action: "user.password_reset_completed",
    targetType: "user",
    targetId: consumed.userId
  });

  return { success: "Password updated. You can sign in with your new password." };
}

const switchOrgSchema = z.object({
  organizationId: z.string().uuid("Invalid organization.")
});

/** Switch the active org in the JWT; validates membership first. */
export async function switchOrganizationAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const parsed = switchOrgSchema.safeParse({
    organizationId: formData.get("organizationId")
  });
  if (!parsed.success) {
    redirect("/dashboard");
  }

  const membership = await getMembership(session.user.id, parsed.data.organizationId);
  if (!membership) {
    redirect("/dashboard");
  }

  const org = await getOrganizationById(parsed.data.organizationId);
  if (!org || org.status === "suspended") {
    redirect("/dashboard");
  }

  await unstable_update({
    organizationId: org.id,
    organizationName: org.name,
    role: membership.role
  });

  await writeAuditLog({
    organizationId: org.id,
    actorUserId: session.user.id,
    action: "user.organization_switched",
    targetType: "organization",
    targetId: org.id
  });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
