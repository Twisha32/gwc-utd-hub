'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { AdminNav } from '@/components/AdminNav';
import { Protected } from '@/components/Protected';
import { fetcher } from '@/lib/api';
import { shortDate, timeRange } from '@/lib/format';
import type { EventItem } from '@/lib/types';

function EventsAdmin() {
  const { data, error } = useSWR<{ events: EventItem[] }>('/events?when=all&limit=200', fetcher);
  const events = [...(data?.events ?? [])].reverse();

  return (
    <div className="wrap page">
      <title>Manage events | GWC at UTD</title>
      <div className="page-head">
        <h1>Admin</h1>
        <Link href="/admin/events/new" className="btn btn--primary">
          New event
        </Link>
      </div>
      <AdminNav />

      {error ? (
        <div className="form-error" role="alert">
          Events didn&apos;t load. Refresh the page to try again.
        </div>
      ) : !data ? (
        <div className="skeleton" style={{ height: 240 }} />
      ) : events.length === 0 ? (
        <div className="empty">
          <h3>No events yet</h3>
          <p>Create the first one and members can start RSVPing.</p>
          <Link href="/admin/events/new" className="btn btn--primary">
            New event
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
                <th className="num">RSVPs</th>
                <th className="num">Checked in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const ended = new Date(e.endsAt).getTime() < Date.now();
                return (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.title}</strong>
                      {e.location && <div className="muted small">{e.location}</div>}
                    </td>
                    <td>
                      {shortDate(e.startsAt)}
                      <div className="muted small">{timeRange(e.startsAt, e.endsAt)}</div>
                    </td>
                    <td className="num">
                      {e.goingCount}
                      {e.capacity ? ` / ${e.capacity}` : ''}
                      {e.waitlistCount > 0 && <div className="muted small">{e.waitlistCount} waiting</div>}
                    </td>
                    <td className="num">{ended || e.attendedCount > 0 ? e.attendedCount : '-'}</td>
                    <td className="actions">
                      <Link href={`/admin/events/${e.id}`} className="btn btn--sm">
                        Manage
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminEventsPage() {
  return (
    <Protected officer>
      <EventsAdmin />
    </Protected>
  );
}
