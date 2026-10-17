'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { EventForm } from '@/components/EventForm';
import { Protected, PageSkeleton } from '@/components/Protected';
import { api, errorMessage, fetcher } from '@/lib/api';
import { longDate, stamp, timeRange } from '@/lib/format';
import type { EventItem, MemberRow, RosterRow } from '@/lib/types';

function PresentCode({ title, code, onClose }: { title: string; code: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="present" role="dialog" aria-modal="true" aria-label="Check-in code">
      <button className="btn" onClick={onClose} autoFocus>
        Close
      </button>
      <h2>{title}</h2>
      <div className="big-code">{code}</div>
      <p>Open the event page on your phone and enter this code to check in.</p>
    </div>
  );
}

function WalkInSearch({ eventId, onAdded, checkedIds }: { eventId: string; onAdded: () => void; checkedIds: Set<string> }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<MemberRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await api(`/users?q=${encodeURIComponent(q.trim())}&limit=6`);
        setResults(res.users);
      } catch (err) {
        setError(errorMessage(err));
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  async function add(userId: string) {
    try {
      await api(`/events/${eventId}/attendance/${userId}`, { method: 'PUT' });
      setQ('');
      setResults([]);
      onAdded();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      <label htmlFor="walkin" className="sr-only">
        Search members to check in
      </label>
      <input
        id="walkin"
        className="input"
        placeholder="Check someone in by name or email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      {error && <p className="field-error" role="alert">{error}</p>}
      {results.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 6 }}>
          {results.map((m) => (
            <li
              key={m.id}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}
            >
              <span>
                {m.name} <span className="muted small">{m.email}</span>
              </span>
              {checkedIds.has(m.id) ? (
                <span className="pill pill--ok">Checked in</span>
              ) : (
                <button className="btn btn--sm" onClick={() => add(m.id)}>
                  Check in
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && results.length === 0 && !error && (
        <p className="muted small" style={{ marginTop: 8 }}>
          No one matches that.
        </p>
      )}
    </div>
  );
}

function ManageEvent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { mutate: mutateAll } = useSWRConfig();

  const { data, error, mutate } = useSWR<{ event: EventItem }>(`/events/${id}`, fetcher);
  const { data: rosterData, mutate: mutateRoster } = useSWR<{ roster: RosterRow[] }>(
    `/events/${id}/roster`,
    fetcher,
    { refreshInterval: 8_000 },
  );

  const [presenting, setPresenting] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);

  if (error) {
    return (
      <div className="wrap page">
        <div className="empty">
          <h3>We couldn&apos;t find that event</h3>
          <Link href="/admin/events" className="btn">
            Back to events
          </Link>
        </div>
      </div>
    );
  }
  if (!data) return <PageSkeleton />;

  const event = data.event;
  const roster = rosterData?.roster ?? [];
  const checkedIn = roster.filter((r) => r.checkedInAt);
  const rsvpCount = roster.filter((r) => r.rsvpStatus === 'going').length;
  const checkedIds = new Set(checkedIn.map((r) => r.id));

  const refreshAll = async () => {
    await Promise.all([
      mutate(),
      mutateRoster(),
      mutateAll((key) => typeof key === 'string' && key.startsWith('/events?')),
    ]);
  };

  async function toggle(row: RosterRow) {
    setMessage('');
    try {
      await api(`/events/${id}/attendance/${row.id}`, { method: row.checkedInAt ? 'DELETE' : 'PUT' });
      await refreshAll();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }

  async function newCode() {
    setMessage('');
    try {
      await api(`/events/${id}/checkin-code`, { method: 'POST' });
      await mutate();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${event.title}"? RSVPs and attendance for it go too. This can't be undone.`)) return;
    try {
      await api(`/events/${id}`, { method: 'DELETE' });
      await mutateAll((key) => typeof key === 'string' && key.startsWith('/events'));
      router.push('/admin/events');
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }

  return (
    <div className="wrap page">
      <title>{`Manage ${event.title} | GWC at UTD`}</title>
      {presenting && event.checkinCode && (
        <PresentCode title={event.title} code={event.checkinCode} onClose={() => setPresenting(false)} />
      )}

      <p style={{ marginBottom: 20 }}>
        <Link href="/admin/events">All events</Link>
      </p>
      <div className="page-head">
        <div>
          <h1>{event.title}</h1>
          <p>
            {longDate(event.startsAt)}, {timeRange(event.startsAt, event.endsAt)}
            {event.location && ` at ${event.location}`}
          </p>
        </div>
        <Link href={`/events/${id}`} className="btn btn--sm">
          View public page
        </Link>
      </div>

      {message && (
        <div className="form-error" role="alert" style={{ marginBottom: 20 }}>
          {message}
        </div>
      )}

      <div className="admin-grid">
        <section className="panel" aria-labelledby="roster-h">
          <h2 id="roster-h">Attendance</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            {checkedIn.length} checked in, {rsvpCount} RSVPed
            {event.capacity ? ` of ${event.capacity} spots` : ''}
          </p>

          <WalkInSearch eventId={id} onAdded={refreshAll} checkedIds={checkedIds} />

          {roster.length === 0 ? (
            <p className="muted" style={{ marginTop: 20 }}>
              No one has RSVPed or checked in yet.
            </p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 20 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>RSVP</th>
                    <th>Checked in</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.name}
                        <div className="muted small">{r.email}</div>
                      </td>
                      <td>
                        {r.rsvpStatus === 'going' && <span className="pill pill--violet">Going</span>}
                        {r.rsvpStatus === 'waitlist' && <span className="pill pill--warn">Waitlist</span>}
                        {!r.rsvpStatus && <span className="muted small">Walk-in</span>}
                      </td>
                      <td>
                        {r.checkedInAt ? (
                          <>
                            {stamp(r.checkedInAt)}
                            <div className="muted small">{r.checkInMethod === 'officer' ? 'By an officer' : 'With the code'}</div>
                          </>
                        ) : (
                          <span className="muted">Not yet</span>
                        )}
                      </td>
                      <td className="actions">
                        <button className="btn btn--sm" onClick={() => toggle(r)}>
                          {r.checkedInAt ? 'Undo' : 'Check in'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="stack" style={{ ['--gap' as string]: '24px' }}>
          <section className="panel" aria-labelledby="code-h">
            <h2 id="code-h">Check-in code</h2>
            <div className="code-display" aria-label={`Code ${event.checkinCode?.split('').join(' ')}`}>
              {event.checkinCode}
            </div>
            <p className="muted small" style={{ margin: '12px 0 16px' }}>
              Members can use it from 30 minutes before the start until an hour after the end.{' '}
              {event.checkinOpen ? <strong>Check-in is open now.</strong> : 'Check-in is closed right now.'}
            </p>
            <div className="form-actions">
              <button className="btn btn--primary" onClick={() => setPresenting(true)}>
                Show on screen
              </button>
              <button className="btn" onClick={newCode}>
                New code
              </button>
            </div>
          </section>

          <section className="panel" aria-labelledby="danger-h">
            <h2 id="danger-h">Delete event</h2>
            <p className="muted small" style={{ marginBottom: 14 }}>
              Removes the event along with its RSVPs and attendance records.
            </p>
            <button className="btn btn--danger" onClick={remove}>
              Delete event
            </button>
          </section>
        </div>
      </div>

      <section className="panel" style={{ marginTop: 24, maxWidth: 720 }} aria-labelledby="edit-h">
        <h2 id="edit-h">Edit details</h2>
        <EventForm
          initial={event}
          submitLabel="Save changes"
          onSaved={async () => {
            await refreshAll();
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
          }}
        />
        {saved && (
          <p className="result result--ok" role="status" style={{ marginTop: 12 }}>
            Saved.
          </p>
        )}
      </section>
    </div>
  );
}

export default function ManageEventPage() {
  return (
    <Protected officer>
      <ManageEvent />
    </Protected>
  );
}
