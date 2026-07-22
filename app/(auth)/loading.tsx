export default function AuthLoading() {
  return (
    <div className="auth-loading" role="status" aria-live="polite" aria-label="Loading">
      <div className="auth-loading-card">
        <div className="skeleton skeleton-avatar" />
        <div className="skeleton skeleton-title" style={{ width: "60%" }} />
        <div className="skeleton skeleton-sub" style={{ width: "80%" }} />
        <div className="skeleton skeleton-input" />
        <div className="skeleton skeleton-input" />
        <div className="skeleton skeleton-button" />
      </div>
    </div>
  );
}
