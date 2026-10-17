'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from './api';
import type { User } from './types';

export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<{ user: User }>('/auth/me', fetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
  return { user: data?.user ?? null, loading: isLoading && !error, refresh: mutate };
}

// Sends signed-out people to the login page and remembers where they were going.
export function useRequireUser() {
  const state = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!state.loading && !state.user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [state.loading, state.user, router, pathname]);

  return state;
}
