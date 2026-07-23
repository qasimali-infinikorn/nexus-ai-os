"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Check, Sparkles } from "lucide-react";
import { requestPasswordResetAction } from "@/lib/actions/auth";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, undefined);

  return (
    <div className="auth-card">
      <div className="auth-card-brand">
        <span className="auth-card-mark">
          <Sparkles size={16} strokeWidth={2.4} aria-hidden />
        </span>
        <span>Nexus</span>
      </div>

      <h1 className="auth-title">Reset password</h1>
      <p className="auth-subtitle">We&rsquo;ll email a one-hour link if that account exists.</p>

      {state?.error ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}

      {state?.success ? (
        <div className="save-notice" role="status" style={{ marginBottom: 16 }}>
          <Check size={16} aria-hidden />
          <span>{state.success}</span>
        </div>
      ) : null}

      <form action={action} className="auth-form">
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

        <button type="submit" className="btn-primary auth-submit" disabled={pending} aria-busy={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="auth-footer">
        <Link href="/login">Back to sign in</Link>
      </p>
    </div>
  );
}
