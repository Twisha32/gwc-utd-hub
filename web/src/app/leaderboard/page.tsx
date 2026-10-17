'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { Protected } from '@/components/Protected';
import { fetcher } from '@/lib/api';
import { plural } from '@/lib/format';
import type { LeaderRow } from '@/lib/types';

function Board() {
  const { data, error } = useSWR<{ leaderboard: LeaderRow[] }>('/ctf/leaderboard', fetcher, {
    refreshInterval: 30_000,
  });
  const rows = data?.leaderboard ?? [];
  const me = rows.find((r) => r.isMe);

  return (
    <div className="wrap page">
      <title>Leaderboard | GWC at UTD</title>
      <div className="page-head">
        <div>
          <h1>Leaderboard</h1>
          <p>
            Ranked by CTF points. If two people are tied, whoever got there first is ahead. Officers
            aren&apos;t ranked.
          </p>
        </div>
        {me && (
          <p className="muted" style={{ textAlign: 'right' }}>
            You&apos;re <strong style={{ color: 'var(--ink)' }}>#{me.rank}</strong> with {plural(me.points, 'point')}
          </p>
        )}
      </div>

      {error ? (
        <div className="form-error" role="alert">
          The leaderboard didn&apos;t load. Refresh the page to try again.
        </div>
      ) : !data ? (
        <div className="skeleton" style={{ height: 320 }} />
      ) : rows.length === 0 ? (
        <div className="empty">
          <h3>Nobody has scored yet</h3>
          <p>The first flag on the board gets first place.</p>
          <Link href="/ctf" className="btn btn--primary">
            Go to the challenges
          </Link>
        </div>
      ) : (
        <div className="board" role="table" aria-label="CTF leaderboard">
          <div className="board-row board-head" role="row">
            <span role="columnheader" style={{ textAlign: 'center' }}>
              Rank
            </span>
            <span role="columnheader">Name</span>
            <span role="columnheader" className="n solves">
              Solves
            </span>
            <span role="columnheader" className="n">
              Points
            </span>
          </div>
          {rows.map((r) => (
            <div key={r.id} className={`board-row${r.isMe ? ' is-me' : ''}`} role="row">
              <span role="cell" className={`rank${r.rank === 1 ? ' first' : ''}`}>
                {r.rank}
              </span>
              <span role="cell" className="who">
                {r.name}
                {r.isMe && <span className="pill pill--violet" style={{ marginLeft: 10 }}>You</span>}
              </span>
              <span role="cell" className="n solves">
                {r.solves}
              </span>
              <span role="cell" className="n pts">
                {r.points}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Protected>
      <Board />
    </Protected>
  );
}
