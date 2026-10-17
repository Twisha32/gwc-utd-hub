import Link from 'next/link';
import { dateParts, plural, relativeDay, spotsLeft, timeRange } from '@/lib/format';
import type { EventItem } from '@/lib/types';

export function EventRow({ event, ended = false }: { event: EventItem; ended?: boolean }) {
  const d = dateParts(event.startsAt);
  const left = spotsLeft(event);
  const when = relativeDay(event.startsAt);

  return (
    <article className="row">
      <div className="date-block" aria-hidden="true">
        <div className="m">{d.month}</div>
        <div className="d">{d.day}</div>
        <div className="w">{d.weekday}</div>
      </div>

      <div>
        <Link href={`/events/${event.id}`} className="row-title">
          {event.title}
        </Link>
        <p className="row-meta">
          {when && <strong>{when[0].toUpperCase() + when.slice(1)}, </strong>}
          {timeRange(event.startsAt, event.endsAt)}
          {event.location && <span className="muted"> at {event.location}</span>}
        </p>
        {event.description && <p className="row-desc">{event.description}</p>}
      </div>

      <div className="row-aside">
        {event.checkedIn ? (
          <span className="pill pill--ok">Checked in</span>
        ) : event.myStatus === 'going' ? (
          <span className="pill pill--violet">You&apos;re going</span>
        ) : event.myStatus === 'waitlist' ? (
          <span className="pill pill--warn">On the waitlist</span>
        ) : null}
        <span>{ended ? `${event.attendedCount} attended` : `${event.goingCount} going`}</span>
        {!ended && left !== null && (
          <span className={left === 0 ? 'pill pill--warn' : 'muted'}>
            {left === 0 ? 'Full, waitlist open' : plural(left, 'spot') + ' left'}
          </span>
        )}
      </div>
    </article>
  );
}

export function EventRowSkeleton() {
  return (
    <div className="row" aria-hidden="true">
      <div className="skeleton" style={{ height: 64, width: 52 }} />
      <div style={{ display: 'grid', gap: 10 }}>
        <div className="skeleton" style={{ height: 24, width: '55%' }} />
        <div className="skeleton" style={{ height: 16, width: '40%' }} />
      </div>
      <div className="skeleton" style={{ height: 16, width: 70 }} />
    </div>
  );
}
