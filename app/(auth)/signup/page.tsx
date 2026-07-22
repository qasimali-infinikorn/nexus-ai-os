"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Sparkles } from "lucide-react";
import { signupAction } from "@/lib/actions/auth";

function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, undefined);
  const from = useSearchParams().get("from") ?? "";

  return (
    <div className="auth-card">
      <div className="auth-card-brand">
        <span className="auth-card-mark">
          <Sparkles size={16} strokeWidth={2.4} aria-hidden />
        </span>
        <span>Nexus</span>
      </div>

      <h1 className="auth-title">Create your workspace</h1>
      <p className="auth-subtitle">
        You&rsquo;ll be the owner of a new organization. Invite teammates after you sign in.
      </p>

      {state?.error ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}

      <form action={action} className="auth-form">
        <input type="hidden" name="from" value={from} />
        <div className="form-group">
          <label className="form-label" htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="form-input auth-input"
            placeholder="Alex Morgan"
            autoComplete="name"
          />
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
            className="form-input auth-input"
            placeholder="Acme Cloud"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="email">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="form-input auth-input"
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
            className="form-input auth-input"
            placeholder="At least 8 characters"
          />
          <span className="form-hint">Must include a letter and a number.</span>
        </div>

        <button type="submit" className="btn-primary auth-submit" disabled={pending} aria-busy={pending}>
          {pending ? "Creating…" : "Create workspace"}
        </button>
      </form>

      <p className="auth-footer">
        Already have a workspace? <Link href="/login">Sign in</Link>
      </p>
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
