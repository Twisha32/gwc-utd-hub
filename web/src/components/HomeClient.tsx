'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import type { EventItem } from '@/lib/types';
import { EventRow, EventRowSkeleton } from './EventRow';

export function HeroActions() {
  const { user, loading } = useUser();

  if (loading) return <div className="hero-actions" style={{ minHeight: 44 }} />;

  return (
    <div className="hero-actions">
      {user ? (
        <>
          <Link href="/events" className="btn btn--primary">
            See upcoming events
          </Link>
          <Link href="/ctf" className="btn">
            Play the CTF
          </Link>
        </>
      ) : (
        <>
          <Link href="/register" className="btn btn--primary">
            Join the club
          </Link>
          <Link href="/events" className="btn">
            See upcoming events
          </Link>
        </>
      )}
    </div>
  );
}

export function UpcomingEvents() {
  const { data, error } = useSWR<{ events: EventItem[] }>('/events?when=upcoming&limit=3', fetcher);

  return (
    <section className="section" aria-labelledby="coming-up">
      <div className="section-head">
        <h2 id="coming-up">Coming up</h2>
        <Link href="/events">All events</Link>
      </div>

      {error ? (
        <p className="muted">Events didn&apos;t load. Refresh the page to try again.</p>
      ) : !data ? (
        <div className="rows">
          <EventRowSkeleton />
          <EventRowSkeleton />
        </div>
      ) : data.events.length === 0 ? (
        <div className="empty">
          <h3>Nothing scheduled yet</h3>
          <p>New events show up here as soon as an officer posts them.</p>
        </div>
      ) : (
        <div className="rows">
          {data.events.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </div>
      )}
    </section>
  );
}
