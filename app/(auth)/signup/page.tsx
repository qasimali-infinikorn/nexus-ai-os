"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, AlertCircle } from "lucide-react";
import { signupAction } from "@/lib/actions/auth";
import { RunButton } from "@/components/ui";

function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, undefined);
  const from = useSearchParams().get("from") ?? "";

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <span className="mark">
          <Sparkles size={18} aria-hidden />
        </span>
        <div>
          <p style={{ fontWeight: 700 }}>Nexus</p>
          <p className="form-hint">Engineering OS</p>
        </div>
      </div>

      <h1 className="auth-title">Create your workspace</h1>
      <p className="auth-subtitle">You&rsquo;ll be the owner of a new organization.</p>

      {state?.error ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}

      <form action={action}>
        <input type="hidden" name="from" value={from} />
        <div className="form-group">
          <label className="form-label" htmlFor="name">
            Your name
          </label>
          <input id="name" name="name" type="text" required className="form-input" placeholder="Alex Morgan" />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="organizationName">
            Organization name
          </label>
          <input
            id="organizationName"
            name="organizationName"
            type="text"
            required
            className="form-input"
            placeholder="Acme Cloud"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="form-input"
            placeholder="you@company.com"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="form-input"
            placeholder="At least 8 characters"
          />
          <span className="form-hint">Must include a letter and a number.</span>
        </div>

        <RunButton type="submit" loading={pending} idleLabel="Create workspace" loadingLabel="Creating…" />
      </form>

      <div className="auth-footer">
        Already have a workspace?{" "}
        <Link href="/login" className="text-gradient" style={{ fontWeight: 600 }}>
          Log in
        </Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
