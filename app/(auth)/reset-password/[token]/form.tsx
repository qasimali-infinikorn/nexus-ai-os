"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Check, Sparkles } from "lucide-react";
import { resetPasswordAction } from "@/lib/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);

  return (
    <div className="auth-card">
      <div className="auth-card-brand">
        <span className="auth-card-mark">
          <Sparkles size={16} strokeWidth={2.4} aria-hidden />
        </span>
        <span>Nexus</span>
      </div>

      <h1 className="auth-title">Choose a new password</h1>
      <p className="auth-subtitle">At least 8 characters, with a letter and a number.</p>

      {state?.error ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}

      {state?.success ? (
        <div className="stack-md">
          <div className="save-notice" role="status">
            <Check size={16} aria-hidden />
            <span>{state.success}</span>
          </div>
          <Link href="/login" className="btn-primary auth-submit">
            Sign in
          </Link>
        </div>
      ) : (
        <form action={action} className="auth-form">
          <input type="hidden" name="token" value={token} />
          <div className="form-group">
            <label className="form-label" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="form-input auth-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="form-input auth-input"
            />
          </div>
          <button type="submit" className="btn-primary auth-submit" disabled={pending} aria-busy={pending}>
            {pending ? "Saving…" : "Update password"}
          </button>
        </form>
      )}

      <p className="auth-footer">
        <Link href="/forgot-password">Request a new link</Link>
      </p>
    </div>
  );
}
