'use client';

import type { ReactNode } from 'react';
import { useRequireUser } from '@/lib/hooks';

export function PageSkeleton() {
  return (
    <div className="wrap page" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 44, width: 260, marginBottom: 28 }} />
      <div className="skeleton" style={{ height: 120, width: '100%' }} />
    </div>
  );
}

// Wrap a page in this when it needs a signed in user. Pass officer to also
// require the officer role.
export function Protected({ children, officer = false }: { children: ReactNode; officer?: boolean }) {
  const { user, loading } = useRequireUser();

  if (loading || !user) return <PageSkeleton />;

  if (officer && user.role !== 'officer') {
    return (
      <div className="wrap page">
        <div className="empty">
          <h3>Officers only</h3>
          <p>This page is for chapter officers. If you should have access, ask an officer to update your role.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
