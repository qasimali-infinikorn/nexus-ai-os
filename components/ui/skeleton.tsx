import type { CSSProperties } from "react";

/** Shared skeleton primitives for route loading states. */
export function Skeleton({
  className = "",
  style
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={`skeleton ${className}`.trim()} style={style} aria-hidden />;
}

export function PageLoadingSkeleton() {
  return (
    <div className="page-loading" role="status" aria-live="polite" aria-label="Loading">
      <div className="page-loading-header">
        <Skeleton className="skeleton-title" />
        <Skeleton className="skeleton-sub" />
      </div>
      <div className="page-loading-grid">
        <Skeleton className="skeleton-card" />
        <Skeleton className="skeleton-card" />
        <Skeleton className="skeleton-card" />
        <Skeleton className="skeleton-card" />
      </div>
      <Skeleton className="skeleton-block" />
    </div>
  );
}
