'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { api } from '@/lib/api';
import { club } from '@/lib/club';
import { useUser } from '@/lib/hooks';
import { LogoMark } from './Logo';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { user, loading } = useUser();

  const links = [
    { href: '/events', label: 'Events' },
    { href: '/ctf', label: 'CTF' },
    { href: '/leaderboard', label: 'Leaderboard' },
    ...(user?.role === 'officer' ? [{ href: '/admin', label: 'Admin' }] : []),
  ];
  const current = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  async function signOut() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    // drop everything cached for the previous person
    await mutate(() => true, undefined, { revalidate: false });
    router.push('/');
  }

  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link href="/" className="brand" aria-label={`${club.short} home`}>
          <LogoMark />
          <span>{club.short}</span>
        </Link>

        <nav className="nav" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={current(l.href) ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          {loading ? null : user ? (
            <>
              <Link href="/profile" className="me-link">
                <span className="avatar" aria-hidden="true">
                  {user.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="me-name">{user.name.split(' ')[0]}</span>
              </Link>
              <button className="btn btn--ghost btn--sm" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn--ghost btn--sm">
                Sign in
              </Link>
              <Link href="/register" className="btn btn--primary btn--sm">
                Join
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
