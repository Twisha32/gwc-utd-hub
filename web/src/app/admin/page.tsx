'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { AdminNav } from '@/components/AdminNav';
import { Protected } from '@/components/Protected';
import { fetcher } from '@/lib/api';
import { shortDate } from '@/lib/format';
import type { Stats } from '@/lib/types';

function Overview() {
  const { data, error } = useSWR<Stats>('/stats', fetcher);
  const t = data?.totals;
  const peak = Math.max(1, ...(data?.recentEvents.map((e) => Math.max(e.rsvps, e.attended)) ?? [1]));

  return (
    <div className="wrap page">
      <title>Admin | GWC at UTD</title>
      <div className="page-head">
        <h1>Admin</h1>
      </div>
      <AdminNav />

      {error ? (
        <div className="form-error" role="alert">
          Stats didn&apos;t load. Refresh the page to try again.
        </div>
      ) : (
        <div className="admin-grid">
          <div className="stack" style={{ ['--gap' as string]: '24px' }}>
            <section className="panel" aria-labelledby="totals-h">
              <h2 id="totals-h">The chapter right now</h2>
              <dl className="totals">
                <div>
                  <dt>Members</dt>
                  <dd>
                    {t?.members ?? '-'} {t && <small>{t.newMembers} joined in the last 30 days</small>}
                  </dd>
                </div>
                <div>
                  <dt>Upcoming events</dt>
                  <dd>{t?.upcomingEvents ?? '-'}</dd>
                </div>
                <div>
                  <dt>Events held</dt>
                  <dd>{t?.pastEvents ?? '-'}</dd>
                </div>
                <div>
                  <dt>CTF challenges live</dt>
                  <dd>
                    {t?.challenges ?? '-'} {t && <small>{t.solves} solves by {t.solvers} people</small>}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="panel" aria-labelledby="att-h">
              <h2 id="att-h">RSVPs vs who showed up</h2>
              <div className="legend">
                <span>
                  <i style={{ background: 'var(--violet-tint)', border: '1px solid var(--line-strong)' }} />
                  RSVPed
                </span>
                <span>
                  <i style={{ background: 'var(--violet)' }} />
                  Checked in
                </span>
              </div>
              {!data ? (
                <div className="skeleton" style={{ height: 120 }} />
              ) : data.recentEvents.length === 0 ? (
                <p className="muted">Attendance shows up here once an event has finished.</p>
              ) : (
                <div className="bars">
                  {data.recentEvents.map((e) => (
                    <div key={e.id} className="bar-row">
                      <div className="bar-label">
                        <Link href={`/admin/events/${e.id}`}>{e.title}</Link>
                        <span className="muted">
                          {shortDate(e.startsAt)}, {e.attended} of {e.rsvps} RSVPs
                        </span>
                      </div>
                      <div className="bar-track" style={{ width: `${(e.rsvps / peak) * 100}%` }}>
                        <div
                          className="bar-fill"
                          style={{ width: `${e.rsvps ? Math.min(100, (e.attended / e.rsvps) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="panel" aria-labelledby="quick-h">
            <h2 id="quick-h">Quick actions</h2>
            <div className="quick-links">
              <Link href="/admin/events/new" className="btn btn--primary">
                New event
              </Link>
              <Link href="/admin/ctf" className="btn">
                Add a CTF challenge
              </Link>
              <Link href="/admin/members" className="btn">
                Find a member
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Protected officer>
      <Overview />
    </Protected>
  );
}
