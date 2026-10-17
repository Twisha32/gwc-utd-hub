'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Protected } from '@/components/Protected';
import { TextField } from '@/components/fields';
import { api, ApiError, errorMessage, fetcher } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import type { Summary } from '@/lib/types';

function Profile() {
  const { user, refresh } = useUser();
  const { data } = useSWR<{ summary: Summary }>('/users/me/summary', fetcher);

  const [form, setForm] = useState({ name: '', major: '', gradYear: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) setForm({ name: user.name, major: user.major ?? '', gradYear: user.gradYear?.toString() ?? '' });
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFields({});
    setSaved(false);
    try {
      const res = await api('/users/me', {
        method: 'PATCH',
        body: {
          name: form.name,
          major: form.major,
          gradYear: form.gradYear === '' ? null : Number(form.gradYear),
        },
      });
      await refresh(res, { revalidate: false });
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFields(err.fields);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const stat = (value: number | undefined, label: string) => (
    <div>
      <div className="v">{value ?? '-'}</div>
      <div className="l">{label}</div>
    </div>
  );

  return (
    <div className="wrap page">
      <title>Profile | GWC at UTD</title>
      <div className="page-head">
        <div>
          <h1>{user?.name}</h1>
          <p>{user?.email}</p>
        </div>
        {user?.role === 'officer' && <span className="pill pill--pink">Officer</span>}
      </div>

      <div className="summary-row">
        {stat(data?.summary.attended, 'Events attended')}
        {stat(data?.summary.upcomingRsvps, 'Upcoming RSVPs')}
        {stat(data?.summary.ctfPoints, 'CTF points')}
        {stat(data?.summary.ctfSolves, 'Challenges solved')}
      </div>

      <form className="panel" onSubmit={save} noValidate style={{ maxWidth: 640 }}>
        <h2>Your details</h2>
        <div className="form-grid">
          <div className="full">
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={fields.name}
              autoComplete="name"
            />
          </div>
          <TextField
            label="Major"
            optional
            value={form.major}
            onChange={(e) => setForm({ ...form, major: e.target.value })}
            error={fields.major}
          />
          <TextField
            label="Graduation year"
            optional
            inputMode="numeric"
            value={form.gradYear}
            onChange={(e) => setForm({ ...form, gradYear: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            error={fields.gradYear}
            placeholder="2028"
          />
          <div className="full form-actions">
            <button className="btn btn--primary" disabled={busy}>
              {busy ? 'Saving...' : 'Save changes'}
            </button>
            {saved && (
              <span className="result result--ok" role="status">
                Saved.
              </span>
            )}
          </div>
          {error && (
            <div className="full form-error" role="alert">
              {error}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Protected>
      <Profile />
    </Protected>
  );
}
