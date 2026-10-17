'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/ctf', label: 'Challenges' },
  { href: '/admin/members', label: 'Members' },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="subnav" aria-label="Admin">
      {items.map((i) => {
        const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
