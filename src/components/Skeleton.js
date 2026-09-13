import React from 'react';

export function Skeleton({ width, height = 14, radius = 8, className = '' }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{
        width: width || '100%',
        height,
        borderRadius: radius,
      }}
    />
  );
}

export function SkeletonStatCards({ count = 6 }) {
  return (
    <section className="stat-grid stat-grid-compact">
      {Array.from({ length: count }).map((_, i) => (
        <article key={i} className="stat-card stat-card-sm">
          <Skeleton width={28} height={28} radius={8} />
          <div className="stat-card-body" style={{ width: '100%' }}>
            <Skeleton width="40%" height={10} />
            <Skeleton width="24%" height={14} />
          </div>
        </article>
      ))}
    </section>
  );
}

export function SkeletonTable({ rows = 8, cols = 6 }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <Skeleton width={i === 0 ? 18 : '60%'} height={10} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((__, c) => (
                <td key={c}>
                  <Skeleton
                    width={c === 0 ? 18 : c === 1 ? '80%' : '55%'}
                    height={c === 1 ? 28 : 12}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonFilters() {
  return (
    <div className="filter-bar">
      <Skeleton height={38} radius={8} />
      <Skeleton height={38} radius={8} />
      <Skeleton height={38} radius={8} />
      <Skeleton height={38} radius={8} />
    </div>
  );
}

export function SkeletonPageHeader() {
  return (
    <header className="page-header">
      <div style={{ width: '100%', maxWidth: 420 }}>
        <Skeleton width="40%" height={22} />
        <div style={{ height: 8 }} />
        <Skeleton width="75%" height={12} />
      </div>
      <Skeleton width={120} height={36} radius={8} />
    </header>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="page dashboard-page">
      <SkeletonPageHeader />
      <SkeletonStatCards count={8} />
      <section className="chart-grid">
        <section className="panel chart-panel">
          <div className="panel-header">
            <Skeleton width={140} height={16} />
          </div>
          <Skeleton height={260} radius={12} className="full-skel" />
        </section>
        <section className="panel chart-panel">
          <div className="panel-header">
            <Skeleton width={160} height={16} />
          </div>
          <Skeleton height={260} radius={12} className="full-skel" />
        </section>
        <section className="panel chart-panel chart-panel-wide">
          <div className="panel-header">
            <Skeleton width={150} height={16} />
          </div>
          <Skeleton height={280} radius={12} className="full-skel" />
        </section>
      </section>
    </div>
  );
}

export function LeadsSkeleton() {
  return (
    <div className="page leads-page">
      <SkeletonPageHeader />
      <SkeletonStatCards count={6} />
      <section className="panel leads-panel">
        <div className="leads-toolbar">
          <Skeleton width={140} height={18} />
          <SkeletonFilters />
        </div>
        <SkeletonTable rows={8} cols={7} />
        <div className="pagination">
          <Skeleton width={160} height={32} />
          <Skeleton width={220} height={32} />
          <Skeleton width={140} height={32} />
        </div>
      </section>
    </div>
  );
}

export function PanelTableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="page">
      <SkeletonPageHeader />
      <section className="panel">
        <div className="panel-header">
          <Skeleton width={140} height={16} />
        </div>
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <Skeleton height={38} />
          <Skeleton height={38} />
          <Skeleton height={38} className="full" />
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <Skeleton width={120} height={16} />
        </div>
        <SkeletonTable rows={rows} cols={cols} />
      </section>
    </div>
  );
}
