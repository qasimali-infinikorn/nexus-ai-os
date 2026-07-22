import { Skeleton } from "@/components/ui/skeleton";

/** Denser loading state matched to Superadmin KPI + table layout. */
export function AdminPageLoadingSkeleton() {
  return (
    <div className="admin-loading page-enter" role="status" aria-live="polite" aria-label="Loading">
      <div className="admin-loading-header">
        <Skeleton className="skeleton-title" style={{ width: 180 }} />
        <Skeleton className="skeleton-sub" style={{ width: 280 }} />
      </div>
      <div className="admin-loading-kpis">
        <Skeleton className="skeleton-card" />
        <Skeleton className="skeleton-card" />
        <Skeleton className="skeleton-card" />
        <Skeleton className="skeleton-card" />
      </div>
      <div className="admin-loading-panels">
        <Skeleton className="skeleton-block" style={{ minHeight: 220 }} />
        <Skeleton className="skeleton-block" style={{ minHeight: 220 }} />
      </div>
    </div>
  );
}
