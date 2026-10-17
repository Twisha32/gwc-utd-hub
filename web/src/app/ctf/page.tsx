'use client';

import { useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { CheckIcon } from '@/components/Icons';
import { Protected } from '@/components/Protected';
import { api, errorMessage, fetcher } from '@/lib/api';
import { plural } from '@/lib/format';
import { useUser } from '@/lib/hooks';
import type { Challenge } from '@/lib/types';

// Descriptions can hold fenced blocks (three backticks) for payloads and snippets.
function Description({ text }: { text: string }) {
  const parts = text.split('```');
  return (
    <div className="desc">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <pre key={i}>{part.replace(/^\n/, '').replace(/\n$/, '')}</pre>
        ) : (
          part
            .split(/\n{2,}/)
            .filter((p) => p.trim())
            .map((p, j) => <p key={`${i}-${j}`}>{p.trim()}</p>)
        ),
      )}
    </div>
  );
}

function ChallengeCard({ c, open, onToggle }: { c: Challenge; open: boolean; onToggle: () => void }) {
  const { mutate } = useSWRConfig();
  const [flag, setFlag] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | { ok: boolean; text: string }>(null);
  const [showHint, setShowHint] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await api(`/ctf/challenges/${c.id}/submit`, { method: 'POST', body: { flag } });
      if (res.correct) {
        setResult({
          ok: true,
          text: res.firstBlood
            ? `Correct, and you were the first to solve it. +${res.points} points.`
            : `Correct. +${res.points} points.`,
        });
        setFlag('');
        await Promise.all([
          mutate('/ctf/challenges'),
          mutate('/ctf/leaderboard'),
          mutate('/users/me/summary'),
        ]);
      } else {
        setResult({ ok: false, text: "That isn't it. Flags look like gwc{...}, check the format and try again." });
      }
    } catch (err) {
      setResult({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="challenge" data-cat={c.category} data-solved={c.solved}>
      <button className="challenge-head" onClick={onToggle} aria-expanded={open}>
        <span className="t">
          {c.title}
          {!c.published && (
            <span className="pill pill--warn" style={{ marginLeft: 10 }}>
              Draft
            </span>
          )}
        </span>
        <span className="sub">
          {c.category}, {plural(c.solveCount, 'solve')}
        </span>
        <span className="pts">
          {c.solved && <CheckIcon size={20} />}
          {c.points}
        </span>
      </button>

      {open && (
        <div className="challenge-body">
          <Description text={c.description} />

          {c.hint && (
            <div className="hint">
              {showHint ? (
                <>
                  <strong>Hint:</strong> {c.hint}
                </>
              ) : (
                <button className="btn btn--ghost btn--sm" onClick={() => setShowHint(true)}>
                  Show hint
                </button>
              )}
            </div>
          )}

          {c.solved ? (
            <p className="result result--ok" role="status">
              {result?.ok ? result.text : 'You solved this one.'}
            </p>
          ) : c.published ? (
            <form onSubmit={submit} className="stack" style={{ ['--gap' as string]: '10px' }}>
              <div className="flag-form">
                <label htmlFor={`flag-${c.id}`} className="sr-only">
                  Flag
                </label>
                <input
                  id={`flag-${c.id}`}
                  className="input"
                  value={flag}
                  onChange={(e) => setFlag(e.target.value)}
                  placeholder="gwc{...}"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button className="btn btn--primary" disabled={busy || flag.trim() === ''}>
                  {busy ? 'Checking...' : 'Submit flag'}
                </button>
              </div>
              {result && (
                <p className={`result ${result.ok ? 'result--ok' : 'result--bad'}`} role="status">
                  {result.text}
                </p>
              )}
            </form>
          ) : (
            <p className="muted small">Drafts can&apos;t be solved yet. Publish it from the admin page.</p>
          )}
        </div>
      )}
    </article>
  );
}

function CtfBoard() {
  const { user } = useUser();
  const { data, error } = useSWR<{ challenges: Challenge[] }>('/ctf/challenges', fetcher);
  const [cat, setCat] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const challenges = data?.challenges ?? [];
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    challenges.forEach((c) => counts.set(c.category, (counts.get(c.category) ?? 0) + 1));
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [challenges]);

  const shown = challenges.filter((c) => cat === 'all' || c.category === cat);
  const solved = challenges.filter((c) => c.solved && c.published);
  const points = solved.reduce((sum, c) => sum + c.points, 0);

  return (
    <div className="wrap page">
      <title>CTF | GWC at UTD</title>
      <div className="page-head">
        <div>
          <h1>Capture the flag</h1>
          <p>
            Each challenge hides a flag shaped like <code>gwc&#123;...&#125;</code>. Find it, submit it, and the points
            land on the leaderboard.
          </p>
        </div>
        {data && (
          <p className="muted" style={{ textAlign: 'right' }}>
            <strong style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: '1.6rem' }}>
              {points}
            </strong>{' '}
            points from {plural(solved.length, 'solve')}
            {user?.role === 'officer' && <span className="small"><br />Officers aren&apos;t ranked.</span>}
          </p>
        )}
      </div>

      {error ? (
        <div className="form-error" role="alert">
          Challenges didn&apos;t load. Refresh the page to try again.
        </div>
      ) : !data ? (
        <div className="skeleton" style={{ height: 240 }} />
      ) : challenges.length === 0 ? (
        <div className="empty">
          <h3>No challenges yet</h3>
          <p>Officers are still writing the first set. They will appear here once they&apos;re published.</p>
        </div>
      ) : (
        <div className="ctf-layout">
          <div className="cat-filter" role="group" aria-label="Category">
            <button className="cat-btn" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>
              All <span className="count">{challenges.length}</span>
            </button>
            {categories.map(([name, n]) => (
              <button key={name} className="cat-btn" aria-pressed={cat === name} onClick={() => setCat(name)}>
                {name} <span className="count">{n}</span>
              </button>
            ))}
          </div>

          <div className="challenges">
            {shown.map((c) => (
              <ChallengeCard
                key={c.id}
                c={c}
                open={openId === c.id}
                onToggle={() => setOpenId(openId === c.id ? null : c.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CtfPage() {
  return (
    <Protected>
      <CtfBoard />
    </Protected>
  );
}
