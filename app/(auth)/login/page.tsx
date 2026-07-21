"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, AlertCircle } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";
import { RunButton } from "@/components/ui";

function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
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

      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-subtitle">Log in to your workspace.</p>

      {state?.error ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}

      <form action={action}>
        <input type="hidden" name="from" value={from} />
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
            autoComplete="current-password"
            required
            className="form-input"
            placeholder="••••••••"
          />
        </div>

        <RunButton
          type="submit"
          loading={pending}
          idleLabel="Log in"
          loadingLabel="Logging in…"
        />
      </form>

      <div className="auth-footer">
        Don&rsquo;t have a workspace yet?{" "}
        <Link href="/signup" className="text-gradient" style={{ fontWeight: 600 }}>
          Create one
        </Link>
      </div>
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
