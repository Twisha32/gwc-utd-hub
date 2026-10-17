'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { CheckIcon } from '@/components/Icons';
import { PageSkeleton } from '@/components/Protected';
import { api, ApiError, errorMessage, fetcher } from '@/lib/api';
import { longDate, plural, spotsLeft, timeRange } from '@/lib/format';
import { useUser } from '@/lib/hooks';
import type { EventItem } from '@/lib/types';

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const { mutate: mutateAll } = useSWRConfig();
  const { data, error, mutate } = useSWR<{ event: EventItem }>(`/events/${id}`, fetcher);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');

  if (error) {
    return (
      <div className="wrap page">
        <div className="empty">
          <h3>We couldn&apos;t find that event</h3>
          <p>It may have been removed.</p>
          <Link href="/events" className="btn">
            Back to events
          </Link>
        </div>
      </div>
    );
  }
  if (!data) return <PageSkeleton />;

  const event = data.event;
  const ended = new Date(event.endsAt).getTime() < Date.now();
  const left = spotsLeft(event);
  const full = left === 0;
  const fill = event.capacity ? Math.min(100, (event.goingCount / event.capacity) * 100) : 0;

  async function refresh() {
    await mutate();
    // lists elsewhere show this event too
    await mutateAll((key) => typeof key === 'string' && key.startsWith('/events?'));
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage('');
    try {
      await fn();
      await refresh();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const rsvp = () => run(() => api(`/events/${id}/rsvp`, { method: 'PUT' }));
  const cancel = () => run(() => api(`/events/${id}/rsvp`, { method: 'DELETE' }));

  async function checkIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setCodeError('');
    try {
      await api(`/events/${id}/checkin`, { method: 'POST', body: { code } });
      setCode('');
      await refresh();
    } catch (err) {
      setCodeError(err instanceof ApiError && err.fields?.code ? err.fields.code : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap page">
      <title>{`${event.title} | GWC at UTD`}</title>
      <p style={{ marginBottom: 20 }}>
        <Link href="/events">All events</Link>
      </p>

      <div className="detail">
        <div className="detail-main">
          <h1>{event.title}</h1>
          <dl className="facts">
            <dt>When</dt>
            <dd>
              {longDate(event.startsAt)}
              <br />
              <span className="muted" style={{ fontWeight: 400 }}>
                {timeRange(event.startsAt, event.endsAt)}
              </span>
            </dd>
            {event.location && (
              <>
                <dt>Where</dt>
                <dd>{event.location}</dd>
              </>
            )}
            <dt>Going</dt>
            <dd>
              {event.goingCount}
              {event.waitlistCount > 0 && (
                <span className="muted" style={{ fontWeight: 400 }}>
                  {' '}
                  and {event.waitlistCount} on the waitlist
                </span>
              )}
            </dd>
          </dl>

          {event.description && <p className="prose" style={{ marginTop: 28 }}>{event.description}</p>}
        </div>

        <aside className="detail-side" aria-label="RSVP and check-in">
          <div className="panel">
            {!user ? (
              <div className="stack" style={{ ['--gap' as string]: '14px' }}>
                <p className="action-title">{ended ? 'This event has ended' : 'Want to come?'}</p>
                {!ended && (
                  <>
                    <p className="muted">Sign in to RSVP and check in when you arrive.</p>
                    <Link
                      href={`/login?next=${encodeURIComponent(`/events/${id}`)}`}
                      className="btn btn--primary btn--wide"
                    >
                      Sign in to RSVP
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <div className="stack" style={{ ['--gap' as string]: '14px' }}>
                {event.checkedIn ? (
                  <div className="status-line">
                    <span className="check">
                      <CheckIcon />
                    </span>
                    <div>
                      <p className="action-title">You&apos;re checked in</p>
                      <p className="muted small">Thanks for coming.</p>
                    </div>
                  </div>
                ) : ended ? (
                  <>
                    <p className="action-title">This event has ended</p>
                    {event.myStatus === 'going' && <p className="muted">You RSVPed but weren&apos;t checked in.</p>}
                  </>
                ) : event.myStatus === 'going' ? (
                  <>
                    <p className="action-title">You&apos;re going</p>
                    <p className="muted">We saved you a spot.</p>
                    <button className="btn btn--wide" onClick={cancel} disabled={busy}>
                      Cancel RSVP
                    </button>
                  </>
                ) : event.myStatus === 'waitlist' ? (
                  <>
                    <p className="action-title">You&apos;re on the waitlist</p>
                    <p className="muted">If someone cancels, you move up automatically.</p>
                    <button className="btn btn--wide" onClick={cancel} disabled={busy}>
                      Leave waitlist
                    </button>
                  </>
                ) : (
                  <>
                    <p className="action-title">{full ? 'This one is full' : 'Save your spot'}</p>
                    {event.capacity !== null && (
                      <div>
                        <div className="capacity-bar" aria-hidden="true">
                          <span style={{ width: `${fill}%` }} />
                        </div>
                        <p className="muted small">
                          {full
                            ? `All ${event.capacity} spots are taken. You can join the waitlist.`
                            : `${plural(left ?? 0, 'spot')} left of ${event.capacity}`}
                        </p>
                      </div>
                    )}
                    <button className="btn btn--primary btn--wide" onClick={rsvp} disabled={busy}>
                      {full ? 'Join the waitlist' : 'RSVP'}
                    </button>
                  </>
                )}
                {message && (
                  <p className="field-error" role="alert">
                    {message}
                  </p>
                )}
              </div>
            )}
          </div>

          {user && !event.checkedIn && !ended && (
            <div className="panel panel--sunk">
              {event.checkinOpen ? (
                <form onSubmit={checkIn} className="stack" style={{ ['--gap' as string]: '12px' }} noValidate>
                  <p className="action-title">Check in</p>
                  <p className="muted small">Enter the code shown at the front of the room.</p>
                  <div className="field">
                    <label htmlFor="code" className="sr-only">
                      Check-in code
                    </label>
                    <input
                      id="code"
                      className="input code-input"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      maxLength={8}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      placeholder="ABC123"
                      aria-invalid={codeError ? true : undefined}
                    />
                    {codeError && (
                      <span className="field-error" role="alert">
                        {codeError}
                      </span>
                    )}
                  </div>
                  <button className="btn btn--primary btn--wide" disabled={busy || code.trim() === ''}>
                    Check in
                  </button>
                </form>
              ) : (
                <p className="muted small">Check-in opens 30 minutes before the event starts.</p>
              )}
            </div>
          )}

          {user?.role === 'officer' && (
            <Link href={`/admin/events/${id}`} className="btn btn--wide">
              Manage this event
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
