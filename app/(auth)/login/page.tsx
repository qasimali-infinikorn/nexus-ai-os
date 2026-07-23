"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Mail, Sparkles } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";

function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.5 2 2 6.5 2 12c0 4.4 2.9 8.1 6.8 9.5.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-4.9 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.8-2.4 4.6-4.6 4.9.3.3.7 1 .7 2v3c0 .3.2.6.7.5A10 10 0 0 0 22 12c0-5.5-4.5-10-10-10z" />
    </svg>
  );
}

function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  const from = useSearchParams().get("from") ?? "";

  return (
    <div className="auth-card">
      <div className="auth-card-brand">
        <span className="auth-card-mark">
          <Sparkles size={16} strokeWidth={2.4} aria-hidden />
        </span>
        <span>Nexus</span>
      </div>

      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-subtitle">Sign in to your workspace</p>

      {state?.error ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className="auth-oauth">
        <button type="button" className="auth-oauth-btn" disabled title="SSO coming soon">
          <Mail size={16} strokeWidth={1.9} aria-hidden />
          Continue with SSO
        </button>
        <button type="button" className="auth-oauth-btn" disabled title="GitHub sign-in coming soon">
          <GitHubIcon />
          Continue with GitHub
        </button>
      </div>

      <div className="auth-divider" role="separator">
        <span>or</span>
      </div>

      <form action={action} className="auth-form">
        <input type="hidden" name="from" value={from} />
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
            placeholder="alex.morgan@acmecloud.com"
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
            autoComplete="current-password"
            required
            className="form-input auth-input"
            placeholder="••••••••"
          />
          <p className="form-hint" style={{ marginTop: 6 }}>
            <Link href="/forgot-password">Forgot password?</Link>
          </p>
        </div>

        <button type="submit" className="btn-primary auth-submit" disabled={pending} aria-busy={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="auth-footer">
        New to Nexus?{" "}
        <Link href="/signup">Create a workspace</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
