'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { EventRow, EventRowSkeleton } from '@/components/EventRow';
import { fetcher } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import type { EventItem } from '@/lib/types';

export default function EventsPage() {
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const { user } = useUser();
  const { data, error } = useSWR<{ events: EventItem[] }>(`/events?when=${when}&limit=100`, fetcher);

  return (
    <div className="wrap page">
      <title>Events | GWC at UTD</title>
      <div className="page-head">
        <div>
          <h1>Events</h1>
          <p>Workshops, career nights and meetings. RSVP so we know how much pizza to order.</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="tabs" role="group" aria-label="Show events">
            <button className="tab" aria-pressed={when === 'upcoming'} onClick={() => setWhen('upcoming')}>
              Upcoming
            </button>
            <button className="tab" aria-pressed={when === 'past'} onClick={() => setWhen('past')}>
              Past
            </button>
          </div>
          {user?.role === 'officer' && (
            <Link href="/admin/events/new" className="btn btn--primary btn--sm">
              New event
            </Link>
          )}
        </div>
      </div>

      {error ? (
        <div className="form-error" role="alert">
          Events didn&apos;t load. Refresh the page to try again.
        </div>
      ) : !data ? (
        <div className="rows">
          <EventRowSkeleton />
          <EventRowSkeleton />
          <EventRowSkeleton />
        </div>
      ) : data.events.length === 0 ? (
        <div className="empty">
          <h3>{when === 'upcoming' ? 'Nothing on the calendar yet' : 'No past events yet'}</h3>
          <p>
            {when === 'upcoming'
              ? 'Check back soon, or look through what we have already done.'
              : 'Events move here once they finish.'}
          </p>
          {when === 'upcoming' && (
            <button className="btn" onClick={() => setWhen('past')}>
              See past events
            </button>
          )}
        </div>
      ) : (
        <div className="rows">
          {data.events.map((e) => (
            <EventRow key={e.id} event={e} ended={when === 'past'} />
          ))}
        </div>
      )}
    </div>
  );
}
