'use client';

import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { AdminNav } from '@/components/AdminNav';
import { Protected } from '@/components/Protected';
import { SelectField, TextAreaField, TextField } from '@/components/fields';
import { api, ApiError, errorMessage, fetcher } from '@/lib/api';
import { CATEGORIES, type Challenge } from '@/lib/types';

const EMPTY = { title: '', category: 'misc', points: '100', flag: '', hint: '', description: '', published: false };

function ChallengeForm({
  editing,
  onDone,
  onCancel,
}: {
  editing: Challenge | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(
    editing
      ? {
          title: editing.title,
          category: editing.category,
          points: String(editing.points),
          flag: '',
          hint: editing.hint ?? '',
          description: editing.description,
          published: editing.published,
        }
      : EMPTY,
  );
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFields({});
    try {
      const body = {
        title: form.title,
        category: form.category,
        description: form.description,
        points: Number(form.points),
        hint: form.hint,
        published: form.published,
        ...(form.flag ? { flag: form.flag } : {}),
      };
      if (editing) await api(`/ctf/challenges/${editing.id}`, { method: 'PATCH', body });
      else await api('/ctf/challenges', { method: 'POST', body });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFields(err.fields);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={onSubmit} noValidate style={{ marginBottom: 28 }}>
      <h2>{editing ? `Edit ${editing.title}` : 'New challenge'}</h2>
      <div className="form-grid">
        <div className="full">
          <TextField label="Title" value={form.title} onChange={set('title')} error={fields.title} />
        </div>
        <SelectField label="Category" value={form.category} onChange={set('category')} error={fields.category}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <TextField label="Points" type="number" min={1} value={form.points} onChange={set('points')} error={fields.points} />
        <div className="full">
          <TextField
            label="Flag"
            className="mono"
            style={{ fontFamily: 'var(--font-mono)' }}
            value={form.flag}
            onChange={set('flag')}
            error={fields.flag}
            placeholder={editing ? 'Leave blank to keep the current flag' : 'gwc{...}'}
            hint="Only a hash is stored, so you can't read it back later. Flags are case sensitive."
            autoComplete="off"
          />
        </div>
        <div className="full">
          <TextAreaField
            label="Description"
            value={form.description}
            onChange={set('description')}
            error={fields.description}
            hint="Wrap payloads or code in three backticks to show them as a block."
            style={{ minHeight: 140 }}
          />
        </div>
        <div className="full">
          <TextField label="Hint" optional value={form.hint} onChange={set('hint')} error={fields.hint} />
        </div>
        <div className="full">
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: 'var(--violet)' }}
            />
            Published, so members can see and solve it
          </label>
        </div>
        {error && (
          <div className="full form-error" role="alert">
            {error}
          </div>
        )}
        <div className="full form-actions">
          <button className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving...' : editing ? 'Save changes' : 'Create challenge'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

function ChallengesAdmin() {
  const { mutate: mutateAll } = useSWRConfig();
  const { data, error, mutate } = useSWR<{ challenges: Challenge[] }>('/ctf/challenges', fetcher);
  const [form, setForm] = useState<{ editing: Challenge | null } | null>(null);
  const [message, setMessage] = useState('');

  const refresh = async () => {
    await mutate();
    await mutateAll('/ctf/leaderboard');
  };

  async function togglePublished(c: Challenge) {
    setMessage('');
    try {
      await api(`/ctf/challenges/${c.id}/published`, { method: 'PUT', body: { published: !c.published } });
      await refresh();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }

  async function remove(c: Challenge) {
    if (!window.confirm(`Delete "${c.title}"? Anyone who solved it loses those points.`)) return;
    setMessage('');
    try {
      await api(`/ctf/challenges/${c.id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }

  const challenges = data?.challenges ?? [];

  return (
    <div className="wrap page">
      <title>Manage challenges | GWC at UTD</title>
      <div className="page-head">
        <h1>Admin</h1>
        {!form && (
          <button className="btn btn--primary" onClick={() => setForm({ editing: null })}>
            New challenge
          </button>
        )}
      </div>
      <AdminNav />

      {form && (
        <ChallengeForm
          key={form.editing?.id ?? 'new'}
          editing={form.editing}
          onCancel={() => setForm(null)}
          onDone={async () => {
            setForm(null);
            await refresh();
          }}
        />
      )}

      {message && (
        <div className="form-error" role="alert" style={{ marginBottom: 16 }}>
          {message}
        </div>
      )}

      {error ? (
        <div className="form-error" role="alert">
          Challenges didn&apos;t load. Refresh the page to try again.
        </div>
      ) : !data ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : challenges.length === 0 ? (
        <div className="empty">
          <h3>No challenges yet</h3>
          <p>Write one, keep it as a draft while you test it, then publish when it&apos;s ready.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Challenge</th>
                <th>Category</th>
                <th className="num">Points</th>
                <th className="num">Solves</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {challenges.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.title}</strong>
                  </td>
                  <td data-cat={c.category}>
                    <span style={{ color: 'var(--cat)', fontWeight: 600 }}>{c.category}</span>
                  </td>
                  <td className="num">{c.points}</td>
                  <td className="num">{c.solveCount}</td>
                  <td>
                    {c.published ? <span className="pill pill--ok">Published</span> : <span className="pill pill--warn">Draft</span>}
                  </td>
                  <td className="actions">
                    <button className="btn btn--sm" onClick={() => setForm({ editing: c })}>
                      Edit
                    </button>
                    <button className="btn btn--sm" onClick={() => togglePublished(c)}>
                      {c.published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button className="btn btn--sm btn--danger" onClick={() => remove(c)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminCtfPage() {
  return (
    <Protected officer>
      <ChallengesAdmin />
    </Protected>
  );
}
